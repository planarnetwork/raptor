import {DayOfWeek, StopID, StopTime, Time, Transfer, Trip} from "../gtfs/GTFS";
import {QueueFactory} from "./QueueFactory";
import {RouteID, RouteScannerFactory} from "./RouteScanner";
import { keyValue } from "ts-array-utils";

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
  public scan(previousArrivals: Arrivals, origin: StopID, date: number, dow: DayOfWeek, time: Time): RaptorResults {
    const bestArrivals = Object.assign({}, previousArrivals, { [origin]: time });
    const kArrivals = [Object.assign({}, bestArrivals)];
    const kConnections = this.stops.reduce(keyValue(s => [s, {}]), {});
    const routeScanner = this.routeScannerFactory.create();

    for (let k = 1, markedStops = [origin]; markedStops.length > 0; k++) {
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
          else if (!stops || previousPiArrival < stops[pi].arrivalTime + interchange) {
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

    return { kConnections, kArrivals };
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

export interface RaptorResults {
  kConnections: ConnectionIndex,
  kArrivals: Arrivals[]
}
