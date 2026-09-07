import type { DateNumber } from "../gtfs/GTFS.js";
import { dayOffset, NOT_COVERED } from "../network/TripCalendar.js";
import { NOT_REACHED, type StopIdx, type Timetable } from "../network/Timetable.js";
import type { Connection, ConnectionIndex } from "./Connection.js";
import {
  CMD_EXIT, CMD_SCAN, createParallelScanState, CTL_COMMAND, CTL_FINISHED, CTL_GENERATION,
  CTL_NEXT_ROUTE, CTL_QUEUE_SIZE, CTL_RUNS_OFFSET, LOG_CAPACITY, LOG_STRIDE,
  type ParallelScanState, type ScanWorker
} from "./ParallelScan.js";
import { RouteQueue } from "./Queue.js";
import type { Origins } from "./RaptorAlgorithm.js";
import type { Arrivals } from "./ScanResults.js";

/**
 * Raptor with the routes of each round scanned by a pool of workers.
 *
 * A round is: build the queue, open it to the workers, wait for them, replay their update logs to
 * repair the labels, then walk the footpaths. Only route scanning is spread out, which is about
 * four fifths of a scan and so caps the speedup near five however many workers there are.
 *
 * The workers are made by the caller, because resolving a worker's url is a question for whatever
 * is bundling the application. They are sent one message, carrying the timetable and the arrays
 * this shares with them; every round after that is opened and closed through shared memory.
 *
 * ```js
 * const workers = Array.from({ length: 8 }, () => new Worker(
 *   new URL("raptor-journey-planner/parallel-worker", import.meta.url)
 * ));
 * const raptor = new ParallelRaptor(network.timetable, workers);
 * ```
 *
 * The thread this runs on blocks while the workers scan, so it must be one that is allowed to:
 * a node thread, or a worker in the browser, but not the browser's main thread.
 */
export class ParallelRaptor {

  private readonly state: ParallelScanState;
  private readonly control: Int32Array;
  private readonly prev: Int32Array;
  private readonly cur: Int32Array;
  private readonly best: Int32Array;
  private readonly bestBefore: Int32Array;
  private readonly queueRoutes: Int32Array;
  private readonly queuePositions: Int32Array;
  private readonly logs: Int32Array[];
  private readonly logCounts: Int32Array;
  private readonly queue: RouteQueue;
  private readonly seen: Int32Array;
  private readonly touched: Int32Array;
  private readonly kConnections: ConnectionIndex;
  private generation = 0;
  private k = 0;

  constructor(
    private readonly timetable: Timetable,
    private readonly workers: ScanWorker[],
    grain: number = 8,
    private readonly timeout: number = 30000
  ) {
    if (workers.length === 0) {
      throw new Error("A ParallelRaptor needs at least one worker");
    }

    const numStops = timetable.interchange.length;

    this.state = createParallelScanState(timetable, workers.length);
    this.control = new Int32Array(this.state.control);
    this.prev = new Int32Array(this.state.prev);
    this.cur = new Int32Array(this.state.cur);
    this.best = new Int32Array(this.state.best);
    this.bestBefore = new Int32Array(numStops);
    this.queueRoutes = new Int32Array(this.state.queueRoutes);
    this.queuePositions = new Int32Array(this.state.queuePositions);
    this.logs = this.state.logs.map(l => new Int32Array(l));
    this.logCounts = new Int32Array(this.state.logCounts);
    this.queue = new RouteQueue(timetable.routes.stopOffsets.length - 1);
    this.seen = new Int32Array(numStops).fill(-1);
    this.touched = new Int32Array(numStops);
    this.kConnections = Array.from({ length: numStops }, () => []);

    // no handshake: a worker that has not started waiting yet finds the generation already moved
    // on and runs the round anyway, and the barrier will not let a round finish without it
    for (let worker = 0; worker < workers.length; worker++) {
      workers[worker].postMessage({ timetable, state: this.state, worker, grain });
    }
  }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: Origins, date: DateNumber): [ConnectionIndex, Arrivals] {
    const offset = dayOffset(this.timetable.routes.calendar, date);

    this.prev.fill(NOT_REACHED);
    this.cur.fill(NOT_REACHED);
    this.best.fill(NOT_REACHED);
    this.k = 0;

    for (let stop = 0; stop < this.kConnections.length; stop++) {
      if (this.kConnections[stop].length > 0) {
        this.kConnections[stop] = [];
      }
    }

    let markedStops: StopIdx[] = [];

    for (const [stop, time] of origins) {
      this.prev[stop] = time;
      this.best[stop] = time;
      markedStops.push(stop);
    }

    Atomics.store(this.control, CTL_RUNS_OFFSET, offset === NOT_COVERED ? 0 : offset);

    while (markedStops.length > 0) {
      this.k++;
      this.buildQueue(markedStops);
      this.bestBefore.set(this.best);
      this.openRound();
      this.awaitRound();

      const marked = this.mergeLogs();

      this.scanTransfers(markedStops, marked);

      markedStops = marked;
      this.prev.set(this.cur);
      this.cur.fill(NOT_REACHED);
    }

    return [this.kConnections, this.best];
  }

  /**
   * Stop the workers. They are not usable afterwards, and neither is this.
   */
  public close(): void {
    Atomics.store(this.control, CTL_COMMAND, CMD_EXIT);
    Atomics.add(this.control, CTL_GENERATION, 1);
    Atomics.notify(this.control, CTL_GENERATION);

    for (const worker of this.workers) {
      worker.terminate();
    }
  }

  private buildQueue(markedStops: StopIdx[]): void {
    this.queue.build(this.timetable.routesByStop, markedStops);

    for (let i = 0; i < this.queue.length; i++) {
      const route = this.queue.routeAt(i);

      this.queueRoutes[i] = route;
      this.queuePositions[route] = this.queue.startPositionOf(route);
    }
  }

  private openRound(): void {
    Atomics.store(this.control, CTL_FINISHED, 0);
    Atomics.store(this.control, CTL_NEXT_ROUTE, 0);
    Atomics.store(this.control, CTL_QUEUE_SIZE, this.queue.length);
    Atomics.store(this.control, CTL_COMMAND, CMD_SCAN);
    Atomics.add(this.control, CTL_GENERATION, 1);
    Atomics.notify(this.control, CTL_GENERATION);
    this.generation++;
  }

  /**
   * Wait for every worker to report the round finished.
   *
   * A worker that never reports would block this thread for good, and nothing else can run on it
   * to notice, so the wait is bounded. Reaching the bound means a worker died or never started.
   */
  private awaitRound(): void {
    let finished = Atomics.load(this.control, CTL_FINISHED);

    while (finished < this.workers.length) {
      if (Atomics.wait(this.control, CTL_FINISHED, finished, this.timeout) === "timed-out") {
        throw new Error(
          `Only ${finished} of ${this.workers.length} scan workers reported back within ` +
          `${this.timeout}ms. A worker has failed to start or has stopped.`
        );
      }

      finished = Atomics.load(this.control, CTL_FINISHED);
    }
  }

  /**
   * Replay every worker's log to restore the labels a lost race may have left too high.
   *
   * A blind write leaves an arrival that is achievable, so it is a valid upper bound, but not
   * necessarily the smallest one attempted. Every attempt was logged, so the smallest logged value
   * at a stop is the one the sequential scan would have ended with. Attempts that do not beat the
   * arrival the stop already had before the round are discarded, which is the test the sequential
   * scan applies as it goes.
   */
  private mergeLogs(): StopIdx[] {
    const { cur, best, bestBefore, logs, logCounts, kConnections } = this;
    const generation = this.generation;

    let touchedCount = 0;

    for (let w = 0; w < this.workers.length; w++) {
      const log = logs[w];
      const count = Math.min(logCounts[w], LOG_CAPACITY);

      for (let i = 0; i < count; i++) {
        const stop = log[i * LOG_STRIDE];

        if (this.seen[stop] !== generation) {
          this.seen[stop] = generation;
          this.touched[touchedCount++] = stop;
          cur[stop] = NOT_REACHED;
        }
      }
    }

    for (let w = 0; w < this.workers.length; w++) {
      const log = logs[w];
      const count = Math.min(logCounts[w], LOG_CAPACITY);

      for (let i = 0; i < count; i++) {
        const at = i * LOG_STRIDE;
        const stop = log[at];
        const arrival = log[at + 1];

        if (arrival < bestBefore[stop] && arrival < cur[stop]) {
          cur[stop] = arrival;
          kConnections[stop][this.k] = [log[at + 2], log[at + 3], log[at + 4], log[at + 5]] as Connection;
        }
      }
    }

    const marked: StopIdx[] = [];

    for (let i = 0; i < touchedCount; i++) {
      const stop = this.touched[i];

      best[stop] = Math.min(bestBefore[stop], cur[stop]);

      if (cur[stop] !== NOT_REACHED) {
        marked.push(stop);
      }
    }

    return marked;
  }

  /**
   * The footpaths, which are a fraction of a percent of a scan and so are left on this thread
   */
  private scanTransfers(markedStops: StopIdx[], marked: StopIdx[]): void {
    const { interchange, transfers } = this.timetable;
    const { offsets, index, destination, duration, from, until } = transfers;
    const { prev, cur, best, kConnections } = this;

    for (const stop of markedStops) {
      const previousArrival = prev[stop];
      const end = offsets[stop + 1];

      for (let i = offsets[stop]; i < end; i++) {
        const to = destination[i];
        const arrival = previousArrival + duration[i] + interchange[to];

        if (from[i] <= arrival && until[i] >= arrival && arrival < best[to]) {
          if (cur[to] === NOT_REACHED) {
            marked.push(to);
          }

          cur[to] = arrival;
          best[to] = arrival;
          kConnections[to][this.k] = index[i];
        }
      }
    }
  }

}
