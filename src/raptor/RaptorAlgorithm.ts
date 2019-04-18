import {DayOfWeek, StopID, StopTime, Time, Transfer, Trip} from "../gtfs/GTFS";
import {QueueFactory} from "./QueueFactory";
import {RouteID, RouteScannerFactory} from "./RouteScanner";

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
   * Perform a scan of the routes at a given time and return the resulting kConnections index
   */
  public scan(
    origin: StopID,
    destination: StopID,
    dateObj: Date,
    time: Time
  ): ConnectionIndex {

    const [bestArrivals, kArrivals, kConnections] = this.createIndexes(origin, time);

    let queue = [origin];

    /*

    WHEN MOVING TO THE NEXT DAY WE TAKE ALL THE STOPS WE HAVE MADE A CONNECTION TO. UNFORTUNATELY THOSE STOPS
    MIGHT HAVE BEEN ARRIVED AT AFTER 1, 2, N NUMBER OF CHANGES. THE RESULTS ALGORITHM ASSUMES EACH CONNECTION LINKS TO
    K - 1

     */

    for (let i = 0, k = 0; i < 2; i++, dateObj.setDate(dateObj.getDate() + 1)) {
      const date = getDateNumber(dateObj);
      const dow = dateObj.getDay() as DayOfWeek;

      k = this.scanDay(k, queue, bestArrivals, kArrivals, kConnections, date, dow);

      if (Object.keys(kConnections[destination]).length > 0) {
        return kConnections;
      }

      queue = [];

      for (const stop in bestArrivals) {
        bestArrivals[stop] = bestArrivals[stop] - 86400;

        if (Object.keys(kConnections[stop]).length > 0) {
          queue.push(stop);
        }
      }
    }

    return {};
  }

  private scanDay(
    k: number,
    markedStops: StopID[],
    bestArrivals: Arrivals,
    kArrivals: ArrivalsByNumChanges,
    kConnections: ConnectionIndex,
    date: number,
    dow: DayOfWeek
  ): number {

    const routeScanner = this.routeScannerFactory.create();

    while (markedStops.length > 0) {
      const queue = this.queueFactory.getQueue(markedStops);

      k++;
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
          } else if (previousPiArrival && (!stops || previousPiArrival < stops[pi].arrivalTime + interchange)) {
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

    return k;
  }

  private createIndexes(origin: StopID, time: Time): [Arrivals, ArrivalsByNumChanges, ConnectionIndex] {
    const bestArrivals = {};
    const kArrivals = [{}];
    const kConnections = {};

    for (const stop of this.stops) {
      bestArrivals[stop] = Number.MAX_SAFE_INTEGER;
      kConnections[stop] = {};
    }

    bestArrivals[origin] = time;
    kArrivals[0][origin] = time;

    return [bestArrivals, kArrivals, kConnections];
  }

}

export function getDateNumber(date: Date): number {
  const str = date.toISOString();

  return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
}

export type RouteStopIndex = Record<RouteID, Record<StopID, number>>;
export type RoutePaths = Record<RouteID, StopID[]>;
export type Interchange = Record<StopID, Time>;
export type TransfersByOrigin = Record<StopID, Transfer[]>;
export type Arrivals = Record<StopID, Time>;
export type Connection = [Trip, number, number];
export type ConnectionIndex = Record<StopID, Record<number, Connection | Transfer>>;
export type ArrivalsByNumChanges = Record<number, Arrivals>;
