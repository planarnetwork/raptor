import type { Time } from "../gtfs/GTFS.js";
import type { Origins } from "./RaptorAlgorithm.js";
import type { ConnectionIndex, TransferIdx } from "./Connection.js";
import { NOT_REACHED, type RouteIdx, type StopIdx } from "../network/Timetable.js";

/**
 * Best arrival time at every stop, overall and per round, plus the connection that achieved it.
 *
 * Everything is a dense array indexed by stop index. Naming a stop, a trip or a transfer is the
 * network's job, and only worth doing for a journey that is returned.
 */
export class ScanResults {
  private k = 0;
  private markedStops: StopIdx[] = [];
  private readonly numStops: number;
  private readonly bestArrivals: Int32Array;
  private readonly kArrivals: Int32Array[];
  private readonly kConnections: ConnectionIndex;

  constructor(numStops: number, origins: Origins) {
    // round zero: the origins are reached at their departure time, nothing else is reached at all
    const initialArrivals = new Int32Array(numStops).fill(NOT_REACHED);

    for (const [stop, time] of origins) {
      initialArrivals[stop] = time;
    }

    this.numStops = numStops;
    this.kArrivals = [initialArrivals];
    this.bestArrivals = initialArrivals.slice();
    this.kConnections = Array.from({ length: numStops }, () => []);
  }

  public addRound(): void {
    this.k++;
    this.kArrivals.push(new Int32Array(this.numStops).fill(NOT_REACHED));
    this.markedStops = [];
  }

  public previousArrival(stop: StopIdx): Time {
    return this.kArrivals[this.k - 1][stop];
  }

  public bestArrival(stop: StopIdx): Time {
    return this.bestArrivals[stop];
  }

  public setTrip(route: RouteIdx, trip: number, from: number, to: number, stop: StopIdx, time: Time): void {
    this.setArrival(stop, time);
    this.kConnections[stop][this.k] = [route, trip, from, to];
  }

  public setTransfer(transfer: TransferIdx, stop: StopIdx, time: Time): void {
    this.setArrival(stop, time);
    this.kConnections[stop][this.k] = transfer;
  }

  public getMarkedStops(): StopIdx[] {
    return this.markedStops;
  }

  public finalize(): [ConnectionIndex, Arrivals] {
    return [this.kConnections, this.bestArrivals];
  }

  private setArrival(stop: StopIdx, time: Time): void {
    const arrivals = this.kArrivals[this.k];

    // an unset arrival for this round means the stop has not been marked yet
    if (arrivals[stop] === NOT_REACHED) {
      this.markedStops.push(stop);
    }

    arrivals[stop] = time;
    this.bestArrivals[stop] = time;
  }
}

/**
 * Best arrival time at each stop, NOT_REACHED where it was never reached
 */
export type Arrivals = Int32Array;
