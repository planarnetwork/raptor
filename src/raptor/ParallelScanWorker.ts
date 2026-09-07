import { DROP_OFF, NOT_REACHED, PICK_UP } from "../network/Timetable.js";
import { NO_TRIP } from "./TripScanner.js";
import {
  CMD_EXIT, CTL_COMMAND, CTL_FINISHED, CTL_GENERATION, CTL_NEXT_ROUTE, CTL_QUEUE_SIZE,
  CTL_RUNS_OFFSET, LOG_CAPACITY, LOG_STRIDE, type ParallelScanSetup
} from "./ParallelScan.js";

/**
 * The route scanning stage of one round, for one worker.
 *
 * It takes routes off the shared queue with an atomic counter and scans them as
 * RaptorAlgorithm.scanRoutes does, writing each result twice: blindly into the shared arrival
 * arrays, and into a log of its own. A blind write can lose a better value to a racing thread,
 * which leaves an arrival that is still achievable and so only costs pruning. The coordinator
 * replays the logs at the barrier to restore the smallest value attempted at each stop. This is
 * the update log parallelization of Delling, Pajor and Werneck, section 3.3.
 *
 * Racing writes cannot tear: the memory model guarantees it for a typed array aligned to its
 * SharedArrayBuffer, so the hot path needs no atomics of its own.
 */
export function createRoundScanner(setup: ParallelScanSetup): () => void {
  const { timetable, state, worker, grain } = setup;
  const { stopOffsets, stops, flags, stopTimesBase, arrivals, departures, tripOffsets } = timetable.routes;
  const runs = timetable.routes.calendar.runs;
  const interchange = timetable.interchange;

  const prev = new Int32Array(state.prev);
  const cur = new Int32Array(state.cur);
  const best = new Int32Array(state.best);
  const queueRoutes = new Int32Array(state.queueRoutes);
  const queuePositions = new Int32Array(state.queuePositions);
  const control = new Int32Array(state.control);
  const log = new Int32Array(state.logs[worker]);
  const logCounts = new Int32Array(state.logCounts);

  /** The trip the route being traversed is scanned back from, reset for every traversal */
  let scanPosition = 0;
  let logCount = 0;
  let runsOffset = 0;

  function earliestTrip(route: number, timesBase: number, numStops: number, position: number, time: number): number {
    const firstTrip = tripOffsets[route];

    let lastFound = NO_TRIP;

    for (let i = scanPosition; i >= 0; i--) {
      if (departures[timesBase + i * numStops + position] < time) {
        break;
      }

      const trip = firstTrip + i;

      if ((runs[runsOffset + (trip >> 3)] & (1 << (trip & 7))) !== 0) {
        lastFound = i;
      }

      if (lastFound === NO_TRIP || lastFound === i) {
        scanPosition = i;
      }
    }

    return lastFound;
  }

  function scanRoute(route: number, startPosition: number): void {
    const stopsBase = stopOffsets[route];
    const numStops = stopOffsets[route + 1] - stopsBase;
    const timesBase = stopTimesBase[route];
    const firstTrip = tripOffsets[route];

    scanPosition = tripOffsets[route + 1] - firstTrip - 1;

    let boardingPoint = -1;
    let trip = NO_TRIP;

    for (let pi = startPosition; pi < numStops; pi++) {
      const stop = stops[stopsBase + pi];
      const previousArrival = prev[stop];
      const arrival = trip === NO_TRIP ? NOT_REACHED : arrivals[timesBase + trip * numStops + pi] + interchange[stop];
      const flag = flags[stopsBase + pi];

      if ((flag & DROP_OFF) !== 0 && arrival < best[stop]) {
        cur[stop] = arrival;
        best[stop] = arrival;

        if (logCount < LOG_CAPACITY) {
          const at = logCount * LOG_STRIDE;

          log[at] = stop;
          log[at + 1] = arrival;
          log[at + 2] = route;
          log[at + 3] = firstTrip + trip;
          log[at + 4] = boardingPoint;
          log[at + 5] = pi;
        }

        logCount++;
      }

      // Deliberately not the `else if` RaptorAlgorithm has. Sequentially the two are the same,
      // because when the label is updated arrival < best[stop] <= prev[stop] and the test below is
      // already false. In parallel they are not: best is written blindly, so a lost race can leave
      // it above the value the sequential scan would hold, which makes the branch above fire where
      // it would not and suppresses a boarding. That label is then in no worker's log, and the
      // barrier has nothing to recover it from.
      if ((flag & PICK_UP) !== 0 && previousArrival !== NOT_REACHED && previousArrival < arrival) {
        const newTrip = earliestTrip(route, timesBase, numStops, pi, previousArrival);

        if (newTrip !== NO_TRIP) {
          trip = newTrip;
          boardingPoint = pi;
        }
      }
    }
  }

  return () => {
    const queueSize = Atomics.load(control, CTL_QUEUE_SIZE);

    runsOffset = Atomics.load(control, CTL_RUNS_OFFSET);
    logCount = 0;

    // routes vary in length by an order of magnitude, so the queue is handed out as workers get to
    // it rather than split up front
    for (;;) {
      const from = Atomics.add(control, CTL_NEXT_ROUTE, grain);

      if (from >= queueSize) {
        break;
      }

      const to = Math.min(from + grain, queueSize);

      for (let q = from; q < to; q++) {
        const route = queueRoutes[q];

        scanRoute(route, queuePositions[route]);
      }
    }

    Atomics.store(logCounts, worker, logCount);
  };
}

/**
 * Wait for each round to be opened, scan it, and report back, until told to stop.
 *
 * This blocks the thread it runs on, which is the point: it is woken by the coordinator writing to
 * shared memory rather than by a message.
 */
export function runScanWorker(setup: ParallelScanSetup): void {
  const control = new Int32Array(setup.state.control);
  const scanRound = createRoundScanner(setup);

  let generation = 0;

  for (;;) {
    Atomics.wait(control, CTL_GENERATION, generation);
    generation = Atomics.load(control, CTL_GENERATION);

    if (Atomics.load(control, CTL_COMMAND) === CMD_EXIT) {
      return;
    }

    scanRound();

    Atomics.add(control, CTL_FINISHED, 1);
    Atomics.notify(control, CTL_FINISHED);
  }
}
