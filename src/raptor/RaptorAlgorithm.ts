import type { ConnectionIndex } from "./Connection";
import type { DateNumber, Time } from "../gtfs/GTFS";
import { buildQueue } from "./Queue";
import { RouteCursor } from "./RouteCursor";
import { NO_TRIP, TripScanner } from "./TripScanner";
import { type Arrivals, ScanResults } from "./ScanResults";
import { NOT_REACHED, type StopIdx, type Timetable } from "../network/Timetable";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {
  /**
   * Reused by every scan. A scan is synchronous, so there is never more than one route in flight.
   */
  private readonly routes: RouteCursor;

  constructor(
    private readonly timetable: Timetable
  ) {
    this.routes = new RouteCursor(timetable.routes);
  }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: Origins, date: DateNumber): [ConnectionIndex, Arrivals] {
    const tripScanner = new TripScanner(this.timetable.routes, date);
    const results = new ScanResults(this.timetable.interchange.length, origins);

    let markedStops = [...origins.keys()];

    while (markedStops.length > 0) {
      results.addRound();

      this.scanRoutes(results, tripScanner, markedStops);
      this.scanTransfers(results, markedStops);

      markedStops = results.getMarkedStops();
    }

    return results.finalize();
  }

  private scanRoutes(results: ScanResults, tripScanner: TripScanner, markedStops: StopIdx[]): void {
    const { interchange } = this.timetable;

    for (const [route, startPosition] of buildQueue(this.timetable.routesByStop, markedStops)) {
      this.routes.moveTo(route);

      let boardingPoint = -1;
      let trip = NO_TRIP;

      for (let pi = startPosition; pi < this.routes.numStops; pi++) {
        const stop = this.routes.stopAt(pi);
        const previousArrival = results.previousArrival(stop);
        const arrival = trip === NO_TRIP ? NOT_REACHED : this.routes.arrival(trip, pi) + interchange[stop];

        if (this.routes.canDropOff(pi) && arrival < results.bestArrival(stop)) {
          results.setTrip(route, this.routes.globalTrip(trip), boardingPoint, pi, stop, arrival);
        }
        // reaching the stop earlier by other means may make an earlier trip on this route
        // catchable, but only where the route picks passengers up
        else if (this.routes.canPickUp(pi) && previousArrival !== NOT_REACHED && previousArrival < arrival) {
          const newTrip = tripScanner.earliestTrip(this.routes, pi, previousArrival);

          if (newTrip !== NO_TRIP) {
            trip = newTrip;
            boardingPoint = pi;
          }
        }
      }
    }
  }

  private scanTransfers(results: ScanResults, markedStops: StopIdx[]): void {
    const { interchange, transfers } = this.timetable;
    const { offsets, index, destination, duration, from, until } = transfers;

    for (const stop of markedStops) {
      const previousArrival = results.previousArrival(stop);
      const end = offsets[stop + 1];

      for (let i = offsets[stop]; i < end; i++) {
        const to = destination[i];
        const arrival = previousArrival + duration[i] + interchange[to];

        if (from[i] <= arrival && until[i] >= arrival && arrival < results.bestArrival(to)) {
          results.setTransfer(index[i], to, arrival);
        }
      }
    }
  }
}

/**
 * The stops a search starts from, each with the time it is reached at
 */
export type Origins = Map<StopIdx, Time>;
