import type { DateNumber, StopID, Time, Transfer } from "../gtfs/GTFS";
import { dayOffset, NOT_COVERED } from "./TripCalendar";
import { buildQueue } from "./Queue";
import { NO_TRIP, RouteScanner } from "./RouteScanner";
import { type Arrivals, type ConnectionIndex, ScanResults } from "./ScanResults";
import { DROP_OFF, NOT_REACHED, PICK_UP, type StopIdx, type Timetable } from "./Timetable";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {

  constructor(
    private readonly timetable: Timetable
  ) { }

  /**
   * Whether the timetable was built with a calendar reaching the given date. Planning for a date
   * it does not cover finds nothing, so queries check before they scan.
   */
  public covers(date: DateNumber): boolean {
    return dayOffset(this.timetable.routes.calendar, date) !== NOT_COVERED;
  }

  /**
   * The period the timetable covers
   */
  public get period(): [DateNumber, DateNumber] {
    const { startDate, endDate } = this.timetable.routes.calendar;

    return [startDate, endDate];
  }

  /**
   * Perform a plan of the routes at a given time and return the resulting kConnections index
   */
  public scan(origins: Origins, date: DateNumber): [ConnectionIndex, Arrivals] {
    const routeScanner = new RouteScanner(this.timetable.routes, date);
    const results = new ScanResults(this.timetable.interchange.length, origins);

    let markedStops = [...origins.keys()];

    while (markedStops.length > 0) {
      results.addRound();

      this.scanRoutes(results, routeScanner, markedStops);
      this.scanTransfers(results, markedStops);

      markedStops = results.getMarkedStops();
    }

    return results.finalize();
  }

  private scanRoutes(results: ScanResults, routeScanner: RouteScanner, markedStops: StopIdx[]): void {
    const { interchange, routes } = this.timetable;
    const { arrivals, flags, stopOffsets, stops, stopTimesBase, tripOffsets } = routes;

    for (const [route, startPosition] of buildQueue(this.timetable.routesByStop, markedStops)) {
      const stopsBase = stopOffsets[route];
      const numStops = stopOffsets[route + 1] - stopsBase;
      const timesBase = stopTimesBase[route];

      let boardingPoint = -1;
      let trip = NO_TRIP;
      let tripBase = -1;

      for (let pi = startPosition; pi < numStops; pi++) {
        const stop = stops[stopsBase + pi];
        const previousArrival = results.previousArrival(stop);

        if (trip !== NO_TRIP) {
          const arrival = arrivals[tripBase + pi] + interchange[stop];

          if ((flags[stopsBase + pi] & DROP_OFF) !== 0 && arrival < results.bestArrival(stop)) {
            results.setTrip(route, tripOffsets[route] + trip, boardingPoint, pi, stop, arrival);
          }
          // reaching the stop earlier by other means may make an earlier trip on this route
          // catchable, but only where the route picks passengers up
          else if ((flags[stopsBase + pi] & PICK_UP) !== 0 && previousArrival !== NOT_REACHED && previousArrival < arrival) {
            const newTrip = routeScanner.getTrip(route, pi, previousArrival);

            if (newTrip !== NO_TRIP) {
              trip = newTrip;
              tripBase = timesBase + newTrip * numStops;
              boardingPoint = pi;
            }
          }
        }
        else if ((flags[stopsBase + pi] & PICK_UP) !== 0 && previousArrival !== NOT_REACHED) {
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

export type Interchange = Record<StopID, Time>;
export type TransfersByOrigin = Record<StopID, Transfer[]>;

/**
 * The stops a search starts from, each with the time it is reached at
 */
export type Origins = Map<StopIdx, Time>;
