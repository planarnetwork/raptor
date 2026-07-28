import type { DayOfWeek, Time } from "../gtfs/GTFS";
import type { RouteIdx, Timetable } from "./Timetable";

/**
 * No trip on the route is reachable.
 */
export const NO_TRIP = -1;

/**
 * Returns trips for specific routes. Maintains the position of the last trip returned in order to
 * reduce plan time.
 */
export class RouteScanner {
  /** Trip each route is scanned back from, starting at its last trip and only ever moving earlier */
  private readonly routeScanPosition: Int32Array;

  constructor(
    private readonly timetable: Timetable,
    private readonly date: number,
    private readonly dow: DayOfWeek,
  ) {
    this.routeScanPosition = Int32Array.from(timetable.routeTrips, trips => trips.length - 1);
  }

  /**
   * Return the index of the earliest trip on the route that can be boarded at the given position,
   * or NO_TRIP if there isn't one.
   */
  public getTrip(route: RouteIdx, position: number, time: Time): number {
    const { departures, routeStopOffsets, routeTrips, stopTimesBase } = this.timetable;
    const numStops = routeStopOffsets[route + 1] - routeStopOffsets[route];
    const trips = routeTrips[route];
    const base = stopTimesBase[route] + position;

    let lastFound = NO_TRIP;

    // iterate backwards through the trips on the route, starting where we last found a trip
    for (let i = this.routeScanPosition[route]; i >= 0; i--) {
      // if the trip is unreachable, exit the loop
      if (departures[base + i * numStops] < time) {
        break;
      }
      // if it is reachable and the service is running that day, update the last valid trip found
      if (trips[i].service.runsOn(this.date, this.dow)) {
        lastFound = i;
      }

      // if we found a trip, update the last found index, if we still haven't found a trip we can also update the
      // last found index as any subsequent scans will be for an earlier time. We can't update the index every time
      // as there may be some services that are reachable but not running before the last found service and searching
      // must continue from the last reachable point.
      if (lastFound === NO_TRIP || lastFound === i) {
        this.routeScanPosition[route] = i;
      }
    }

    return lastFound;
  }

}
