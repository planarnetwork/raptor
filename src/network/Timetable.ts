import type { TripCalendar } from "./TripCalendar.js";

/**
 * Arrival time used for a stop that has not been reached. Chosen to be larger than any real
 * arrival time so it loses every `<` comparison without needing a special case.
 */
export const NOT_REACHED = 0x7fffffff;

/** Bits of Routes.flags */
export const PICK_UP = 1;
export const DROP_OFF = 2;

/**
 * Dense index assigned to a stop, in the range [0, number of stops).
 */
export type StopIdx = number;

/**
 * Dense index assigned to a route, in the range [0, number of routes).
 */
export type RouteIdx = number;

/**
 * Everything the scan reads about a route, in the "global array" form described by the Raptor
 * paper. Variable length data is concatenated into a single flat array, with an offsets array
 * giving the bounds of each slice, so route `r` owns `[stopOffsets[r], stopOffsets[r + 1])` of
 * stops and flags:
 *
 *   stopsInRoute                     stopOffsets[r + 1] - stopOffsets[r]
 *   stop at position p of route r    stops[stopOffsets[r] + p]
 *   arrival of trip t at position p  arrivals[stopTimesBase[r] + t * stopsInRoute + p]
 */
export interface Routes {
  /** Bounds of each route's slice of stops and flags. Its length is the number of routes + 1 */
  stopOffsets: Int32Array;
  /** Concatenated stop sequences of every route */
  stops: Int32Array;
  /** Parallel to stops, the PICK_UP and DROP_OFF bits of each call */
  flags: Uint8Array;
  /** Offset of each route's slice of arrivals and departures. Its length is the number of routes + 1 */
  stopTimesBase: Int32Array;
  /** Concatenated trip-major arrival times of every route */
  arrivals: Int32Array;
  /** Concatenated trip-major departure times of every route */
  departures: Int32Array;
  /** Bounds of each route's trips in the global, route major trip numbering */
  tripOffsets: Int32Array;
  /** Which trips run on which date */
  calendar: TripCalendar;
}

/**
 * The routes picking up at each stop, which is what turns a set of marked stops into a queue of
 * routes to scan. Stop `s` owns `[offsets[s], offsets[s + 1])` of route and position.
 */
export interface RoutesByStop {
  /** Bounds of each stop's slice. Its length is the number of stops + 1 */
  offsets: Int32Array;
  /** Concatenated lists of the routes picking up at each stop */
  route: Int32Array;
  /** Parallel to route, the position of that stop within that route */
  position: Int32Array;
}

/**
 * The footpaths out of each stop. Stop `s` owns `[offsets[s], offsets[s + 1])` of the rest.
 */
export interface Transfers {
  /** Bounds of each stop's slice. Its length is the number of stops + 1 */
  offsets: Int32Array;
  /** The transfer's position in the network's transfers, so a result can name it */
  index: Int32Array;
  destination: Int32Array;
  duration: Int32Array;
  /** Earliest time the footpath can be used */
  from: Int32Array;
  /** Latest time the footpath can be used */
  until: Int32Array;
}

/**
 * Everything the algorithm needs to scan, with every stop, route and trip a dense integer index
 * into a flat typed array. This removes the string hashing and pointer chasing from the hot path.
 *
 * Nothing here names anything the feed would recognise. Turning an index back into a trip, a
 * transfer or a stop id is the network's job, and only happens for a journey that is returned.
 *
 * The number of stops and routes is the length of the arrays holding them, so it is not stored
 * separately.
 */
export interface Timetable {
  routes: Routes;
  routesByStop: RoutesByStop;
  transfers: Transfers;
  /** Minimum interchange time at each stop */
  interchange: Int32Array;
}
