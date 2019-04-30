import { DayOfWeek, StopID, StopTime, Time, Transfer, Trip } from "../gtfs/GTFS";
import { QueueFactory } from "./QueueFactory";
import { RouteID, RouteScannerFactory } from "./RouteScanner";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {

  constructor(
    private readonly routeStopIndex: RouteStopIndex,
    private readonly routePath: RoutePaths,
    private readonly transfers: TransfersByOrigin,
    private readonly interchange: Interchange,
    private readonly stops: StopID[],
    private readonly queueFactory: QueueFactory,
    private readonly routeScannerFactory: RouteScannerFactory
  ) { }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: StopTimes, date: number, dow: DayOfWeek): [ConnectionIndex, Arrivals] {
    const routeScanner = this.routeScannerFactory.create();
    const [bestArrivals, kArrivals, kConnections] = this.createIndexes(origins);

    for (let k = 1, markedStops = Object.keys(origins); markedStops.length > 0; k++) {
      const queue = this.queueFactory.getQueue(markedStops);
      kArrivals[k] = {};

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;
        let trip: Trip | undefined = undefined;

        for (let pi = this.routeStopIndex[routeId][stopP]; pi < this.routePath[routeId].length; pi++) {
          const stopPi = this.routePath[routeId][pi];
          const interchange = this.interchange[stopPi];
          const previousPiArrival = kArrivals[k - 1][stopPi];

          if (stops && stops[pi].dropOff && stops[pi].arrivalTime + interchange < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = stops[pi].arrivalTime + interchange;
            kConnections[stopPi][k] = [trip!, boardingPoint, pi];
          }
          else if (previousPiArrival && (!stops || previousPiArrival < stops[pi].arrivalTime + interchange)) {
            trip = routeScanner.getTrip(routeId, date, dow, pi, previousPiArrival);
            stops = trip && trip.stopTimes;
            boardingPoint = pi;
          }
        }
      }

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          const arrival = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = arrival;
            kConnections[stopPi][k] = transfer;
          }
        }
      }

      markedStops = Object.keys(kArrivals[k]);
    }

    return [kConnections, bestArrivals];
  }

  private createIndexes(origins: StopTimes): [Arrivals, ArrivalsByNumChanges, ConnectionIndex] {
    const bestArrivals = {};
    const kArrivals = [{}];
    const kConnections = {};

    for (const stop of this.stops) {
      bestArrivals[stop] = origins[stop] || Number.MAX_SAFE_INTEGER;
      kArrivals[0][stop] = origins[stop] || Number.MAX_SAFE_INTEGER;
      kConnections[stop] = {};
    }

    return [bestArrivals, kArrivals, kConnections];
  }

}

export type RouteStopIndex = Record<RouteID, Record<StopID, number>>;
export type RoutePaths = Record<RouteID, StopID[]>;
export type Interchange = Record<StopID, Time>;
export type TransfersByOrigin = Record<StopID, Transfer[]>;
export type Arrivals = Record<StopID, Time>;
export type Connection = [Trip, number, number];
export type ConnectionIndex = Record<StopID, Record<number, Connection | Transfer>>;
export type ArrivalsByNumChanges = Record<number, Arrivals>;
export type StopTimes = Record<StopID, Time>;
