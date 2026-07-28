import type { StopID, StopTime, Time, Transfer, Trip } from "../gtfs/GTFS";
import type { Interchange, TransfersByOrigin } from "./RaptorAlgorithm";

/**
 * Dense index assigned to a stop, in the range [0, number of stops).
 */
export type StopIdx = number;

/**
 * Dense index assigned to a route, in the range [0, number of routes).
 */
export type RouteIdx = number;

/**
 * Arrival time used for a stop that has not been reached. Chosen to be larger than any real
 * arrival time so it loses every `<` comparison without needing a special case.
 */
export const NOT_REACHED = 0x7fffffff;

/**
 * A transfer paired with its destination resolved to a stop index. The transfer itself is the one
 * given to the factory, which is what ends up in the returned journeys.
 */
export interface IndexedTransfer {
  destination: StopIdx;
  transfer: Transfer;
}

/**
 * The timetable in the "global array" form described by the Raptor paper: every stop and route is
 * a dense integer index, and everything the scan reads is a flat typed array indexed by those
 * integers. This removes the string hashing and pointer chasing from the hot path.
 *
 * Variable length data is concatenated into a single flat array, with an offsets array giving the
 * bounds of each slice. Route `r` owns `[routeStopOffsets[r], routeStopOffsets[r + 1])` of
 * routeStops, so the offsets array has one more entry than there are routes and the length of a
 * slice is the gap between two offsets:
 *
 *   stopsInRoute                     routeStopOffsets[r + 1] - routeStopOffsets[r]
 *   stop at position p of route r    routeStops[routeStopOffsets[r] + p]
 *   arrival of trip t at position p  arrivals[stopTimesBase[r] + t * stopsInRoute + p]
 *
 * The number of stops and routes is the length of the arrays holding them, so it is not stored
 * separately.
 */
export interface Timetable {
  /** Stop id to stop index, used to translate queries in and results out */
  stopIndex: Map<StopID, StopIdx>;
  /** Stop index to stop id, the inverse of stopIndex. Its length is the number of stops */
  stopIds: StopID[];

  /** Bounds of each route's slice of routeStops and dropOff. Its length is the number of routes + 1 */
  routeStopOffsets: Int32Array;
  /** Concatenated stop sequences of every route */
  routeStops: Int32Array;
  /**
   * Parallel to routeStops, 1 where the route sets down passengers. Pick up and set down are part
   * of the route signature, so every trip on a route shares this pattern.
   */
  dropOff: Uint8Array;

  /** Offset of each route's slice of arrivals and departures. Its length is the number of routes + 1 */
  stopTimesBase: Int32Array;
  /** Concatenated trip-major arrival times of every route */
  arrivals: Int32Array;
  /** Concatenated trip-major departure times of every route */
  departures: Int32Array;

  /** Each route's trips in departure order, for the calendar check and journey reconstruction */
  routeTrips: Trip[][];

  /** Bounds of each stop's slice of stopRoutes and stopRoutePos. Its length is the number of stops + 1 */
  stopRouteOffsets: Int32Array;
  /** Concatenated lists of the routes picking up at each stop */
  stopRoutes: Int32Array;
  /** Parallel to stopRoutes, the position of that stop within that route */
  stopRoutePos: Int32Array;

  /** Minimum interchange time at each stop */
  interchange: Int32Array;
  /** Transfers available from each stop */
  transfers: IndexedTransfer[][];
}

const DEFAULT_INTERCHANGE_TIME = 0;
const OVERTAKING_ROUTE_SUFFIX = "|overtakes";

/**
 * Trips grouped into routes, before they are flattened into the arrays above.
 */
interface RouteGrouping {
  stopIndex: Map<StopID, StopIdx>;
  stopIds: StopID[];
  /** Stop sequence of each route */
  routeStops: StopIdx[][];
  /** Trips on each route, in departure order */
  routeTrips: Trip[][];
  /** For each stop, the routes picking up there and the position of that stop within them */
  stopRoutePositions: Map<RouteIdx, number>[];
}

/**
 * Two trips belong to the same route when they call at the same stops in the same order with the
 * same pick up and set down pattern.
 */
function routeSignature(stops: StopIdx[], stopTimes: StopTime[]): string {
  return stopTimes
    .map((stopTime, i) => `${stops[i]},${stopTime.pickUp ? 1 : 0}${stopTime.dropOff ? 1 : 0}`)
    .join("|");
}

function finalArrival(trip: Trip): Time {
  return trip.stopTimes[trip.stopTimes.length - 1].arrivalTime;
}

/**
 * A trip overtakes a route when it arrives earlier than a trip that departed before it. Raptor
 * needs the trips on a route to be ordered, so an overtaking trip is put on a route of its own.
 */
function overtakes(trip: Trip, routeTrips: Trip[]): boolean {
  for (const other of routeTrips) {
    if (finalArrival(trip) < finalArrival(other)) {
      return true;
    }
  }

  return false;
}

/**
 * Assign every stop and route a dense index and group the trips onto their routes.
 */
function groupTripsIntoRoutes(trips: Trip[], transfers: TransfersByOrigin): RouteGrouping {
  const stopIndex = new Map<StopID, StopIdx>();
  const stopIds: StopID[] = [];
  const stopRoutePositions: Map<RouteIdx, number>[] = [];

  const internStop = (stop: StopID): StopIdx => {
    let index = stopIndex.get(stop);

    if (index === undefined) {
      index = stopIds.length;
      stopIndex.set(stop, index);
      stopIds.push(stop);
      stopRoutePositions.push(new Map());
    }

    return index;
  };

  const routeIndex = new Map<string, RouteIdx>();
  const routeStops: StopIdx[][] = [];
  const routeTrips: Trip[][] = [];

  for (const trip of trips) {
    const stopTimes = trip.stopTimes;
    const stops = stopTimes.map(stopTime => internStop(stopTime.stop));

    let signature = routeSignature(stops, stopTimes);
    const existing = routeIndex.get(signature);

    if (existing !== undefined && overtakes(trip, routeTrips[existing])) {
      signature += OVERTAKING_ROUTE_SUFFIX;
    }

    let route = routeIndex.get(signature);

    if (route === undefined) {
      route = routeStops.length;
      routeIndex.set(signature, route);
      routeStops.push(stops);
      routeTrips.push([]);

      // walk backwards so that on a route calling at a stop twice, the earlier call wins
      for (let p = stops.length - 1; p >= 0; p--) {
        if (stopTimes[p].pickUp) {
          stopRoutePositions[stops[p]].set(route, p);
        }
      }
    }

    routeTrips[route].push(trip);
  }

  // transfers can reach stops that no trip calls at, so they are interned after the trips
  for (const origin of Object.keys(transfers)) {
    internStop(origin);

    for (const transfer of transfers[origin]) {
      internStop(transfer.destination);
    }
  }

  return { stopIndex, stopIds, routeStops, routeTrips, stopRoutePositions };
}

/**
 * Group the trips into routes and flatten the result into the global arrays above.
 *
 * Trips must already be sorted by departure time: the trips of a route are laid out in that order
 * and the scan relies on it to walk backwards to the earliest reachable trip.
 */
export function createTimetable(
  trips: Trip[],
  transfers: TransfersByOrigin,
  interchange: Interchange
): Timetable {
  const { stopIndex, stopIds, routeStops: routeStopSeq, routeTrips, stopRoutePositions } =
    groupTripsIntoRoutes(trips, transfers);

  const numStops = stopIds.length;
  const numRoutes = routeTrips.length;

  // size each route's slice of the flat arrays. Both are offsets arrays, so the last entry is the
  // total length of the array being sliced.
  const routeStopOffsets = new Int32Array(numRoutes + 1);
  const stopTimesBase = new Int32Array(numRoutes + 1);

  for (let route = 0; route < numRoutes; route++) {
    const stopsInRoute = routeStopSeq[route].length;

    routeStopOffsets[route + 1] = routeStopOffsets[route] + stopsInRoute;
    stopTimesBase[route + 1] = stopTimesBase[route] + routeTrips[route].length * stopsInRoute;
  }

  const routeStops = new Int32Array(routeStopOffsets[numRoutes]);
  const dropOff = new Uint8Array(routeStopOffsets[numRoutes]);
  const arrivals = new Int32Array(stopTimesBase[numRoutes]);
  const departures = new Int32Array(stopTimesBase[numRoutes]);

  for (let route = 0; route < numRoutes; route++) {
    const stops = routeStopSeq[route];
    const trips = routeTrips[route];
    const stopsBase = routeStopOffsets[route];

    for (let p = 0; p < stops.length; p++) {
      routeStops[stopsBase + p] = stops[p];
      // set down is part of the route signature, so any trip on the route gives the same answer
      dropOff[stopsBase + p] = trips[0].stopTimes[p].dropOff ? 1 : 0;
    }

    for (let t = 0; t < trips.length; t++) {
      const stopTimes = trips[t].stopTimes;
      const base = stopTimesBase[route] + t * stops.length;

      for (let p = 0; p < stops.length; p++) {
        arrivals[base + p] = stopTimes[p].arrivalTime;
        departures[base + p] = stopTimes[p].departureTime;
      }
    }
  }

  // invert routeStops to get the routes picking up at each stop
  const stopRouteOffsets = new Int32Array(numStops + 1);

  for (let stop = 0; stop < numStops; stop++) {
    stopRouteOffsets[stop + 1] = stopRouteOffsets[stop] + stopRoutePositions[stop].size;
  }

  const stopRoutes = new Int32Array(stopRouteOffsets[numStops]);
  const stopRoutePos = new Int32Array(stopRouteOffsets[numStops]);

  for (let stop = 0; stop < numStops; stop++) {
    let offset = stopRouteOffsets[stop];

    for (const [route, position] of stopRoutePositions[stop]) {
      stopRoutes[offset] = route;
      stopRoutePos[offset] = position;
      offset++;
    }
  }

  const interchangeTimes = new Int32Array(numStops);

  for (let stop = 0; stop < numStops; stop++) {
    interchangeTimes[stop] = interchange[stopIds[stop]] ?? DEFAULT_INTERCHANGE_TIME;
  }

  const indexedTransfers: IndexedTransfer[][] = Array.from({ length: numStops }, () => []);

  for (const origin of Object.keys(transfers)) {
    const from = stopIndex.get(origin) as StopIdx;

    for (const transfer of transfers[origin]) {
      indexedTransfers[from].push({
        destination: stopIndex.get(transfer.destination) as StopIdx,
        transfer
      });
    }
  }

  return {
    stopIndex,
    stopIds,
    routeStopOffsets,
    routeStops,
    dropOff,
    stopTimesBase,
    arrivals,
    departures,
    routeTrips,
    stopRouteOffsets,
    stopRoutes,
    stopRoutePos,
    interchange: interchangeTimes,
    transfers: indexedTransfers
  };
}
