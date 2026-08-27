import type { DateNumber, Time } from "../gtfs/GTFS";
import { dayOffset, NOT_COVERED } from "./TripCalendar";
import type { RouteIdx, Routes } from "./Timetable";

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
  /** The calendar's slice for the date being scanned, or an empty one outside the period it covers */
  private readonly runsToday: Uint8Array;

  constructor(private readonly routes: Routes, date: DateNumber) {
    const calendar = routes.calendar;
    const offset = dayOffset(calendar, date);

    this.routeScanPosition = Int32Array.from(
      { length: routes.tripOffsets.length - 1 },
      (_, route) => routes.tripOffsets[route + 1] - routes.tripOffsets[route] - 1
    );
    this.runsToday = offset === NOT_COVERED
      ? new Uint8Array(calendar.stride)
      : calendar.runs.subarray(offset, offset + calendar.stride);
  }

  /**
   * Return the index of the earliest trip on the route that can be boarded at the given position,
   * or NO_TRIP if there isn't one.
   */
  public getTrip(route: RouteIdx, position: number, time: Time): number {
    const { departures, stopOffsets, stopTimesBase, tripOffsets } = this.routes;
    const numStops = stopOffsets[route + 1] - stopOffsets[route];
    const firstTrip = tripOffsets[route];
    const base = stopTimesBase[route] + position;
    const runsToday = this.runsToday;

    let lastFound = NO_TRIP;

    // iterate backwards through the trips on the route, starting where we last found a trip
    for (let i = this.routeScanPosition[route]; i >= 0; i--) {
      // if the trip is unreachable, exit the loop
      if (departures[base + i * numStops] < time) {
        break;
      }
      // if it is reachable and the trip is running that day, update the last valid trip found
      const trip = firstTrip + i;

      if ((runsToday[trip >> 3] & (1 << (trip & 7))) !== 0) {
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
