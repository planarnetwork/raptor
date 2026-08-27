import type { Stop, StopID, StopIndex, Trip } from "../gtfs/GTFS";
import type { GTFSFeed } from "../gtfs/GTFSLoader";
import type { Interchange, TransfersByOrigin } from "./RaptorAlgorithm";
import { pushNested } from "ts-array-utils";

/**
 * A feed may group stops under a station and those under a station in turn, so the walk up is
 * bounded rather than assumed to terminate.
 */
const MAX_PARENT_DEPTH = 10;

/**
 * Puts the feed into the terms the algorithm plans in: calls are at stations rather than platforms,
 * and only the calls a passenger can use are kept.
 *
 * Interchange time and transfers are defined at the station and a change of vehicle is only
 * possible there, so a feed that identifies platforms individually has to be resolved to the
 * station before it can be planned with.
 *
 * Nothing is discarded. Each stop time keeps the feed's stop id as platformStop and each trip
 * keeps its full stopping pattern, including passing points, as allStopTimes.
 *
 * The trips are rewritten in place, and running twice over the same trips is a no op.
 */
export function normalise(feed: GTFSFeed): TimetableInput {
  const { trips, transfers, interchange, stops } = feed;
  const stations = stationCodes(stops);
  const station = (id: StopID): StopID => stations.get(id) ?? id;
  const stationTrips: Trip[] = [];

  for (const trip of trips) {
    const allStopTimes = trip.allStopTimes ?? trip.stopTimes ?? [];

    for (const stopTime of allStopTimes) {
      const id = stopTime.platformStop ?? stopTime.stop;

      // take the ids from the stop index so every call at a stop shares one string
      stopTime.platformStop = stops[id]?.id ?? id;
      stopTime.stop = station(id);
    }

    trip.allStopTimes = allStopTimes;
    trip.stopTimes = allStopTimes.filter(stopTime => stopTime.pickUp || stopTime.dropOff);

    // a trip that cannot be both boarded and alighted is of no use
    if (trip.stopTimes.length > 1) {
      stationTrips.push(trip);
    }
  }

  const stationTransfers: TransfersByOrigin = {};
  const stationInterchange: Interchange = {};

  for (const stop of Object.keys(interchange)) {
    stationInterchange[station(stop)] = interchange[stop];
  }

  for (const origin of Object.keys(transfers)) {
    for (const transfer of transfers[origin]) {
      const from = station(transfer.origin);
      const to = station(transfer.destination);

      // moving between two platforms of one station is what interchange time is for
      if (from !== to) {
        pushNested({ ...transfer, origin: from, destination: to }, stationTransfers, from);
      }
    }
  }

  return { trips: stationTrips, transfers: stationTransfers, interchange: stationInterchange };
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
 * in.
 */
export interface TimetableInput {
  trips: Trip[];
  transfers: TransfersByOrigin;
  interchange: Interchange;
}
