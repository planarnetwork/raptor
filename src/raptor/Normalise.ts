import type { Stop, StopID, StopIndex, StopTime, Transfer, Trip } from "../gtfs/GTFS";
import type { GTFSFeed } from "../gtfs/GTFSLoader";
import { isCall } from "../gtfs/Calls";
import type { Interchange } from "./RaptorAlgorithm";

/**
 * A feed may group stops under a station and those under a station in turn, so the walk up is
 * bounded rather than assumed to terminate.
 */
const MAX_PARENT_DEPTH = 10;

/**
 * Puts the feed into the terms the algorithm plans in: stops are the stations they belong to, and
 * only the trips a passenger can both board and alight are kept.
 *
 * Interchange time and transfers are defined at the station and a change of vehicle is only
 * possible there, so a feed that identifies platforms individually has to be resolved to the
 * station before it can be planned with.
 *
 * The feed is only read. Where a call is is answered by stations rather than by rewriting the stop
 * times, so the trips keep the stopping pattern the feed gave them, passing points and all.
 */
export function normalise(feed: GTFSFeed): TimetableInput {
  const stations = stationCodes(feed.stops);
  const station = (id: StopID): StopID => stations.get(id) ?? id;
  const trips: Trip[] = [];
  const calls: StopTime[][] = [];

  for (const trip of feed.trips) {
    const tripCalls = trip.stopTimes.filter(isCall);

    // a trip that cannot be both boarded and alighted is of no use
    if (tripCalls.length > 1) {
      trips.push(trip);
      calls.push(tripCalls);
    }
  }

  const transfers: Transfer[] = [];
  const interchange: Interchange = {};

  for (const stop of Object.keys(feed.interchange)) {
    interchange[station(stop)] = feed.interchange[stop];
  }

  for (const origin of Object.keys(feed.transfers)) {
    for (const transfer of feed.transfers[origin]) {
      const from = station(transfer.origin);
      const to = station(transfer.destination);

      // moving between two platforms of one station is what interchange time is for
      if (from !== to) {
        transfers.push({ ...transfer, origin: from, destination: to });
      }
    }
  }

  return { trips, calls, transfers, interchange, stations };
}

/**
 * Maps every stop to the station it belongs to, named by the station's stop_code where the feed
 * gives one. That is the identifier the algorithm plans with.
 *
 * GTFS puts no uniqueness requirement on stop_code, so two stations sharing one are rejected
 * rather than planned as the same place.
 */
function stationCodes(stops: StopIndex): Map<StopID, StopID> {
  const claimed = new Map<StopID, StopID>();
  const stations = new Map<StopID, StopID>();

  for (const stop of Object.values(stops)) {
    const station = resolveStation(stops, stop);
    const code = station.code ?? station.id;
    const owner = claimed.get(code);

    if (owner !== undefined && owner !== station.id) {
      throw new Error(`Stops ${owner} and ${station.id} both have the stop_code ${code}, which identifies the station`);
    }

    claimed.set(code, station.id);
    stations.set(stop.id, code);
  }

  return stations;
}

function resolveStation(stops: StopIndex, stop: Stop, depth = 0): Stop {
  if (depth < MAX_PARENT_DEPTH && stop.parentStation && stops[stop.parentStation]) {
    return resolveStation(stops, stops[stop.parentStation], depth + 1)
  } else {
    return stop;
  }
}

/**
 * What the timetable is built from, once the feed has been put into the terms the algorithm plans
 * in. Trips and calls are parallel: calls[i] is the usable calls of trips[i], in feed order.
 */
export interface TimetableInput {
  trips: Trip[];
  calls: StopTime[][];
  transfers: Transfer[];
  interchange: Interchange;
  /** Feed stop id to the code of the station it belongs to */
  stations: Map<StopID, StopID>;
}
