import type { DateNumber, Time } from "@gb-transit/gtfs-loader";
import { dayOffset, NOT_COVERED } from "../network/TripCalendar.js";
import type { RouteCursor } from "./RouteCursor.js";
import type { Routes } from "../network/Timetable.js";

/**
 * No trip on the route is reachable.
 */
export const NO_TRIP = -1;

/**
 * Finds the trip to board on a route, for one date. Maintains the position of the last trip
 * returned in order to reduce plan time.
 */
export class TripScanner {
  /** Trip the route being traversed is scanned back from, which only ever moves earlier */
  private scanPosition = 0;
  /** The calendar's slice for the date being scanned, or an empty one outside the period it covers */
  private readonly runsToday: Uint8Array;

  constructor(routes: Routes, date: DateNumber) {
    const calendar = routes.calendar;
    const offset = dayOffset(calendar, date);

    this.runsToday = offset === NOT_COVERED
      ? new Uint8Array(calendar.stride)
      : calendar.runs.subarray(offset, offset + calendar.stride);
  }

  /**
   * Start traversing the route the cursor is positioned on, scanning back from its last trip.
   *
   * The scan position is only valid for one traversal. The trip to board can only get earlier as
   * a route is walked, because a trip is only looked for at all where the stop can be reached
   * before the trip already boarded departs it, but a later traversal of the same route may start
   * at an earlier stop or a later time and need a trip further on than the last one found.
   */
  public startRoute(cursor: RouteCursor): void {
    this.scanPosition = cursor.numTrips - 1;
  }

  /**
   * Return the index of the earliest trip on the route the cursor is positioned on that can be
   * boarded at the given position, or NO_TRIP if there isn't one.
   */
  public earliestTrip(cursor: RouteCursor, position: number, time: Time): number {
    const runsToday = this.runsToday;

    let lastFound = NO_TRIP;

    // iterate backwards through the trips on the route, starting where we last found a trip
    for (let i = this.scanPosition; i >= 0; i--) {
      // if the trip is unreachable, exit the loop
      if (cursor.departure(i, position) < time) {
        break;
      }
      // if it is reachable and the trip is running that day, update the last valid trip found
      const trip = cursor.globalTrip(i);

      if ((runsToday[trip >> 3] & (1 << (trip & 7))) !== 0) {
        lastFound = i;
      }

      // if we found a trip, update the last found index, if we still haven't found a trip we can also update the
      // last found index as any subsequent scans will be for an earlier time. We can't update the index every time
      // as there may be some services that are reachable but not running before the last found service and searching
      // must continue from the last reachable point.
      if (lastFound === NO_TRIP || lastFound === i) {
        this.scanPosition = i;
      }
    }

    return lastFound;
  }

}
