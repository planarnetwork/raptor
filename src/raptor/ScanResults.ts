import type { StopID, Time } from "../gtfs/GTFS";
import type { Network } from "./Network";
import type { StopTimes } from "./RaptorAlgorithm";
import { NOT_REACHED, type RouteIdx, type StopIdx } from "./Timetable";

/**
 * Best arrival time at every stop, overall and per round, plus the connection that achieved it.
 *
 * While the scan is running everything is held in dense arrays indexed by stop index. finalize
 * converts the result back to the stop id keyed indexes the rest of the library works with.
 */
export class ScanResults {
  private k = 0;
  private markedStops: StopIdx[] = [];
  private readonly stopIds: StopID[];
  private readonly bestArrivals: Int32Array;
  private readonly kArrivals: Int32Array[];
  private readonly kConnections: (Connection | TransferIdx)[][];

  constructor(network: Network, origins: StopTimes) {
    const { stopIndex, stopIds } = network;

    // round zero: the origins are reached at their departure time, nothing else is reached at all
    const initialArrivals = new Int32Array(stopIds.length).fill(NOT_REACHED);

    for (const origin of Object.keys(origins)) {
      const stop = stopIndex.get(origin);

      if (stop !== undefined) {
        initialArrivals[stop] = origins[origin];
      }
    }

    this.stopIds = stopIds;
    this.kArrivals = [initialArrivals];
    this.bestArrivals = initialArrivals.slice();
    this.kConnections = Array.from({ length: stopIds.length }, () => []);
  }

  public addRound(): void {
    this.k++;
    this.kArrivals.push(new Int32Array(this.stopIds.length).fill(NOT_REACHED));
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
    // null prototype so that a stop id like "__proto__" is stored as an ordinary key
    const kConnections: ConnectionIndex = Object.create(null);
    const bestArrivals: Arrivals = Object.create(null);

    for (let stop = 0; stop < this.stopIds.length; stop++) {
      const stopId = this.stopIds[stop];
      const index: Record<number, Connection | TransferIdx> = Object.create(null);

      // rounds the stop was not reached in are holes in the array, which forEach skips
      this.kConnections[stop].forEach((connection, k) => { index[k] = connection; });

      kConnections[stopId] = index;

      if (this.bestArrivals[stop] !== NOT_REACHED) {
        bestArrivals[stopId] = this.bestArrivals[stop];
      }
    }

    return [kConnections, bestArrivals];
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

export type Arrivals = Record<StopID, Time>;

/**
 * A leg taken on a vehicle: the route, the trip on it, and the positions boarded and alighted at.
 * Network.trips turns the trip into the feed's, and stopAt turns the positions into stops.
 */
export type Connection = [route: RouteIdx, trip: number, from: number, to: number];

/**
 * A leg taken on foot, as an index into Network.transfers
 */
export type TransferIdx = number;

export type ConnectionIndex = Record<StopID, Record<number, Connection | TransferIdx>>;
