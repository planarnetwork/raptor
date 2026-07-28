import type { DayOfWeek, StopID, Time, Transfer } from "../gtfs/GTFS";
import { buildQueue } from "./Queue";
import { NO_TRIP, RouteScanner } from "./RouteScanner";
import { type Arrivals, type ConnectionIndex, ScanResults } from "./ScanResults";
import { NOT_REACHED, type StopIdx, type Timetable } from "./Timetable";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {

  constructor(
    private readonly timetable: Timetable
  ) { }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: StopTimes, date: number, dow: DayOfWeek): [ConnectionIndex, Arrivals] {
    const routeScanner = new RouteScanner(this.timetable, date, dow);
    const results = new ScanResults(this.timetable, origins);
    const stopIndex = this.timetable.stopIndex;

    let markedStops = Object.keys(origins)
      .map(origin => stopIndex.get(origin))
      .filter(stop => stop !== undefined);

    while (markedStops.length > 0) {
      results.addRound();

      this.scanRoutes(results, routeScanner, markedStops);
      this.scanTransfers(results, markedStops);

      markedStops = results.getMarkedStops();
    }

    return results.finalize();
  }

  private scanRoutes(results: ScanResults, routeScanner: RouteScanner, markedStops: StopIdx[]): void {
    const {
      arrivals, dropOff, interchange, routeStopOffsets, routeStops, routeTrips, stopTimesBase
    } = this.timetable;

    for (const [route, startPosition] of buildQueue(this.timetable, markedStops)) {
      const stopsBase = routeStopOffsets[route];
      const numStops = routeStopOffsets[route + 1] - stopsBase;
      const timesBase = stopTimesBase[route];

      let boardingPoint = -1;
      let trip = NO_TRIP;
      let tripBase = -1;

      for (let pi = startPosition; pi < numStops; pi++) {
        const stop = routeStops[stopsBase + pi];
        const previousArrival = results.previousArrival(stop);

        if (trip !== NO_TRIP) {
          const arrival = arrivals[tripBase + pi] + interchange[stop];

          if (dropOff[stopsBase + pi] === 1 && arrival < results.bestArrival(stop)) {
            results.setTrip(routeTrips[route][trip], boardingPoint, pi, stop, arrival);
          }
          else if (previousArrival !== NOT_REACHED && previousArrival < arrival) {
            const newTrip = routeScanner.getTrip(route, pi, previousArrival);

            if (newTrip !== NO_TRIP) {
              trip = newTrip;
              tripBase = timesBase + newTrip * numStops;
              boardingPoint = pi;
            }
          }
        }
        else if (previousArrival !== NOT_REACHED) {
          const newTrip = routeScanner.getTrip(route, pi, previousArrival);

          if (newTrip !== NO_TRIP) {
            trip = newTrip;
            tripBase = timesBase + newTrip * numStops;
            boardingPoint = pi;
          }
        }
      }
    }
  }

  private scanTransfers(results: ScanResults, markedStops: StopIdx[]): void {
    const { interchange, transfers } = this.timetable;

    for (const stop of markedStops) {
      const previousArrival = results.previousArrival(stop);

      for (const indexed of transfers[stop]) {
        const destination = indexed.destination;
        const transfer = indexed.transfer;
        const arrival = previousArrival + transfer.duration + interchange[destination];

        if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < results.bestArrival(destination)) {
          results.setTransfer(transfer, destination, arrival);
        }
      }
    }
  }
}

export type Interchange = Record<StopID, Time>;
export type TransfersByOrigin = Record<StopID, Transfer[]>;
export type StopTimes = Record<StopID, Time>;
