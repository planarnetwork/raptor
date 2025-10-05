import { DayOfWeek, StopID, Time, Transfer, Trip } from "../gtfs/GTFS";
import { QueueFactory } from "./QueueFactory";
import { RouteID, RouteScanner, RouteScannerFactory } from "./RouteScanner";
import { Arrivals, ConnectionIndex, ScanResults } from "./ScanResults";
import { ScanResultsFactory } from "./ScanResultsFactory";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {

  constructor(
    private readonly routeStopIndex: RouteStopIndex,
    private readonly routePath: RoutePaths,
    private readonly transfers: TransfersByOrigin,
    private readonly interchange: Interchange,
    private readonly scanResultsFactory: ScanResultsFactory,
    private readonly queueFactory: QueueFactory,
    private readonly routeScannerFactory: RouteScannerFactory
  ) { }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: StopTimes, date: number, dow: DayOfWeek): [ConnectionIndex, Arrivals] {
    const routeScanner = this.routeScannerFactory.create(date, dow);
    const results = this.scanResultsFactory.create(origins);
    let markedStops = Object.keys(origins);

    while (markedStops.length > 0) {
      results.addRound();

      this.scanRoutes(results, routeScanner, markedStops);
      this.scanTransfers(results, markedStops);

      markedStops = results.getMarkedStops();
    }

    return results.finalize();
  }

  private scanRoutes(results: ScanResults, routeScanner: RouteScanner, markedStops: StopID[]): void {
    const queue = this.queueFactory.getQueue(markedStops);

    for (const [routeId, stopP] of Object.entries(queue)) {

      let boardingPoint = -1;
      let trip: Trip | undefined = undefined;
      const routePath = this.routePath[routeId];
      const routePathLength = routePath.length;

      for (let pi = this.routeStopIndex[routeId][stopP]; pi < routePathLength; pi++) {
        const stopPi = routePath[pi];
        const i = this.interchange[stopPi];
        const previousArrival = results.previousArrival(stopPi);

        if (trip && trip.stopTimes[pi].dropOff && trip.stopTimes[pi].arrivalTime + i < results.bestArrival(stopPi)) {
          results.setTrip(trip, boardingPoint, pi, i);
        }
        else if (previousArrival && (!trip || previousArrival < trip.stopTimes[pi].arrivalTime + i)) {
          const newTrip = routeScanner.getTrip(routeId, pi, previousArrival);

          if (newTrip) {
            trip = newTrip;
            boardingPoint = pi;
          }
        }
      }
    }
  }

  private scanTransfers(results: ScanResults, markedStops: StopID[]): void {
    for (const stopP of markedStops) {
      for (const transfer of this.transfers[stopP] || []) {
        const stopPi = transfer.destination;
        const arrival = results.previousArrival(stopP) + transfer.duration + this.interchange[stopPi];

        if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < results.bestArrival(stopPi)) {
          results.setTransfer(transfer, arrival);
        }
      }
    }
  }
}

export type RouteStopIndex = Record<RouteID, Record<StopID, number>>;
export type RoutePaths = Record<RouteID, StopID[]>;
export type Interchange = Record<StopID, Time>;
export type TransfersByOrigin = Record<StopID, Transfer[]>;
export type StopTimes = Record<StopID, Time>;
