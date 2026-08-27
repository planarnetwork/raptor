import type { DayOfWeek, StopID, StopTime, Time, Transfer, Trip } from "../gtfs/GTFS";
import { getDateNumber } from "../query/DateUtil";
import type { GTFSFeed } from "../gtfs/GTFSLoader";
import { createTripCalendar, getCalendarWindow } from "./TripCalendar";
import { normalise } from "./Normalise";
import { DROP_OFF, PICK_UP, type RouteIdx, type StopIdx, type Timetable } from "./Timetable";

const DEFAULT_INTERCHANGE_TIME = 0;

/**
 * A transfer with no time window has Number.MAX_SAFE_INTEGER as its end, which does not fit in
 * the Int32Array it is packed into. Any time past the largest one a feed can express will do.
 */
const NO_END_TIME = 0x7fffffff;
const OVERTAKING_ROUTE_SUFFIX = "|overtakes";

/**
 * Build the timetable the algorithm scans, and the tables that turn its integers back into the
 * feed's trips, transfers and stops.
 *
 * The trips of a route are laid out in departure order and the scan relies on it to walk backwards
 * to the earliest reachable trip, so they are sorted here rather than by the caller.
 *
 * If a date is given the trips are filtered to those running on it first, which makes planning
 * faster at the cost of only being able to plan for that date.
 */
export function createNetwork(feed: GTFSFeed, date?: Date): Network {
  if (date) {
    const dateNumber = getDateNumber(date);
    const dow = date.getDay() as DayOfWeek;

    feed = { ...feed, trips: feed.trips.filter(trip => trip.service.runsOn(dateNumber, dow)) };
  }

  const { trips, calls, transfers, interchange, stations } = normalise(feed);
  const order = trips
    .map((_, i) => i)
    .sort((a, b) => calls[a][0].departureTime - calls[b][0].departureTime);

  const grouping = groupTripsIntoRoutes(order.map(i => trips[i]), order.map(i => calls[i]), stations, transfers);
  const { stopIds, stopIndex, routeCalls, routeTrips, routeStops: routeStopSeq, stopRoutePositions } = grouping;

  const numStops = stopIds.length;
  const numRoutes = routeTrips.length;

  // size each route's slice of the flat arrays. These are offsets arrays, so the last entry is the
  // total length of the array being sliced.
  const stopOffsets = new Int32Array(numRoutes + 1);
  const stopTimesBase = new Int32Array(numRoutes + 1);
  const tripOffsets = new Int32Array(numRoutes + 1);

  for (let route = 0; route < numRoutes; route++) {
    const stopsInRoute = routeStopSeq[route].length;

    stopOffsets[route + 1] = stopOffsets[route] + stopsInRoute;
    stopTimesBase[route + 1] = stopTimesBase[route] + routeTrips[route].length * stopsInRoute;
    tripOffsets[route + 1] = tripOffsets[route] + routeTrips[route].length;
  }

  const routeStops = new Int32Array(stopOffsets[numRoutes]);
  const flags = new Uint8Array(stopOffsets[numRoutes]);
  const arrivals = new Int32Array(stopTimesBase[numRoutes]);
  const departures = new Int32Array(stopTimesBase[numRoutes]);

  for (let route = 0; route < numRoutes; route++) {
    const stops = routeStopSeq[route];
    const tripCalls = routeCalls[route];
    const stopsBase = stopOffsets[route];

    for (let p = 0; p < stops.length; p++) {
      routeStops[stopsBase + p] = stops[p];
      // pick up and set down are part of the route signature, so any trip gives the same answer
      flags[stopsBase + p] =
        (tripCalls[0][p].pickUp ? PICK_UP : 0) | (tripCalls[0][p].dropOff ? DROP_OFF : 0);
    }

    for (let t = 0; t < tripCalls.length; t++) {
      const base = stopTimesBase[route] + t * stops.length;

      for (let p = 0; p < stops.length; p++) {
        arrivals[base + p] = tripCalls[t][p].arrivalTime;
        departures[base + p] = tripCalls[t][p].departureTime;
      }
    }
  }

  // invert routeStops to get the routes picking up at each stop
  const byStopOffsets = new Int32Array(numStops + 1);

  for (let stop = 0; stop < numStops; stop++) {
    byStopOffsets[stop + 1] = byStopOffsets[stop] + stopRoutePositions[stop].size;
  }

  const byStopRoute = new Int32Array(byStopOffsets[numStops]);
  const byStopPosition = new Int32Array(byStopOffsets[numStops]);

  for (let stop = 0; stop < numStops; stop++) {
    let offset = byStopOffsets[stop];

    for (const [route, position] of stopRoutePositions[stop]) {
      byStopRoute[offset] = route;
      byStopPosition[offset] = position;
      offset++;
    }
  }

  const interchangeTimes = new Int32Array(numStops);

  for (let stop = 0; stop < numStops; stop++) {
    interchangeTimes[stop] = interchange[stopIds[stop]] ?? DEFAULT_INTERCHANGE_TIME;
  }

  const networkTrips = routeTrips.flat();
  const [startDate, endDate] = getCalendarWindow(feed.feedInfo?.startDate, feed.feedInfo?.endDate);

  return {
    timetable: {
      routes: {
        stopOffsets,
        stops: routeStops,
        flags,
        stopTimesBase,
        arrivals,
        departures,
        tripOffsets,
        calendar: createTripCalendar(networkTrips, startDate, endDate)
      },
      routesByStop: {
        offsets: byStopOffsets,
        route: byStopRoute,
        position: byStopPosition
      },
      transfers: indexTransfers(transfers, stopIndex, numStops),
      interchange: interchangeTimes
    },
    stopIds,
    stopIndex,
    stations,
    trips: networkTrips,
    transfers
  };
}

/**
 * Assign every stop and route a dense index and group the trips onto their routes.
 */
function groupTripsIntoRoutes(
  trips: Trip[],
  calls: StopTime[][],
  stations: Map<StopID, StopID>,
  transfers: Transfer[]
): RouteGrouping {
  const stopIndex = new Map<StopID, StopIdx>();
  const stopIds: StopID[] = [];
  const stopRoutePositions: Map<RouteIdx, number>[] = [];

  const internStop = (stop: StopID): StopIdx => {
    const id = stations.get(stop) ?? stop;
    let index = stopIndex.get(id);

    if (index === undefined) {
      index = stopIds.length;
      stopIndex.set(id, index);
      stopIds.push(id);
      stopRoutePositions.push(new Map());
    }

    return index;
  };

  const routeIndex = new Map<string, RouteIdx>();
  const routeStops: StopIdx[][] = [];
  const routeTrips: Trip[][] = [];
  const routeCalls: StopTime[][][] = [];
  const routeLatestArrival: Time[] = [];

  for (let i = 0; i < trips.length; i++) {
    const tripCalls = calls[i];
    const stops = tripCalls.map(stopTime => internStop(stopTime.stop));

    let signature = routeSignature(stops, tripCalls);
    const existing = routeIndex.get(signature);

    if (existing !== undefined && finalArrival(tripCalls) < routeLatestArrival[existing]) {
      signature += OVERTAKING_ROUTE_SUFFIX;
    }

    let route = routeIndex.get(signature);

    if (route === undefined) {
      route = routeStops.length;
      routeIndex.set(signature, route);
      routeStops.push(stops);
      routeTrips.push([]);
      routeCalls.push([]);
      routeLatestArrival.push(Number.MIN_SAFE_INTEGER);

      // walk backwards so that on a route calling at a stop twice, the earlier call wins
      for (let p = stops.length - 1; p >= 0; p--) {
        if (tripCalls[p].pickUp) {
          stopRoutePositions[stops[p]].set(route, p);
        }
      }
    }

    routeTrips[route].push(trips[i]);
    routeCalls[route].push(tripCalls);

    if (finalArrival(tripCalls) > routeLatestArrival[route]) {
      routeLatestArrival[route] = finalArrival(tripCalls);
    }
  }

  // transfers can reach stops that no trip calls at, so they are interned after the trips
  for (const transfer of transfers) {
    internStop(transfer.origin);
    internStop(transfer.destination);
  }

  return { stopIndex, stopIds, routeStops, routeTrips, routeCalls, stopRoutePositions };
}

/**
 * Two trips belong to the same route when they call at the same stops in the same order with the
 * same pick up and set down pattern.
 */
function routeSignature(stops: StopIdx[], calls: StopTime[]): string {
  return calls
    .map((stopTime, i) => `${stops[i]},${stopTime.pickUp ? 1 : 0}${stopTime.dropOff ? 1 : 0}`)
    .join("|");
}

/**
 * A trip overtakes a route when it arrives earlier than a trip that departed before it. Raptor
 * needs the trips on a route to be ordered, so an overtaking trip is put on a route of its own.
 *
 * Trips are added in departure order, so comparing against the latest arrival so far is enough.
 */
function finalArrival(calls: StopTime[]): Time {
  return calls[calls.length - 1].arrivalTime;
}

/**
 * Flatten the transfers into the per stop slices the scan reads, keeping the index of each one so
 * a result can name the transfer it took.
 */
function indexTransfers(transfers: Transfer[], stopIndex: Map<StopID, StopIdx>, numStops: number) {
  const offsets = new Int32Array(numStops + 1);

  for (const transfer of transfers) {
    offsets[(stopIndex.get(transfer.origin) as StopIdx) + 1]++;
  }

  for (let stop = 0; stop < numStops; stop++) {
    offsets[stop + 1] += offsets[stop];
  }

  const index = new Int32Array(transfers.length);
  const destination = new Int32Array(transfers.length);
  const duration = new Int32Array(transfers.length);
  const from = new Int32Array(transfers.length);
  const until = new Int32Array(transfers.length);
  const next = offsets.slice();

  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    const at = next[stopIndex.get(transfer.origin) as StopIdx]++;

    index[at] = i;
    destination[at] = stopIndex.get(transfer.destination) as StopIdx;
    duration[at] = transfer.duration;
    from[at] = transfer.startTime;
    until[at] = Math.min(transfer.endTime, NO_END_TIME);
  }

  return { offsets, index, destination, duration, from, until };
}

/**
 * The timetable the algorithm scans, and the tables that turn the integers it works in back into
 * the feed's trips, transfers and stops.
 */
export interface Network {
  timetable: Timetable;
  /** Stop index to stop id, used to name a stop in a result */
  stopIds: StopID[];
  /** Stop id to stop index, used to translate a query's origins */
  stopIndex: Map<StopID, StopIdx>;
  /** Feed stop id to the code of the station it belongs to */
  stations: Map<StopID, StopID>;
  /** Global trip index to the feed's trip, in the route major order the calendar is bit packed in */
  trips: Trip[];
  /** Transfer index to the feed's transfer */
  transfers: Transfer[];
}

/**
 * Trips grouped into routes, before they are flattened into the timetable's arrays.
 */
interface RouteGrouping {
  stopIndex: Map<StopID, StopIdx>;
  stopIds: StopID[];
  /** Stop sequence of each route */
  routeStops: StopIdx[][];
  /** Trips on each route, in departure order */
  routeTrips: Trip[][];
  /** Parallel to routeTrips, the usable calls of each trip */
  routeCalls: StopTime[][][];
  /** For each stop, the routes picking up there and the position of that stop within them */
  stopRoutePositions: Map<RouteIdx, number>[];
}
