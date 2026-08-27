import type { StopID, StopTime, Time, Trip } from "../gtfs/GTFS";
import { callAt } from "../gtfs/Calls";
import type { Network } from "../raptor/Network";
import type { Connection } from "../raptor/ScanResults";
import type { StopIdx } from "../raptor/Timetable";

/**
 * A connection is four integers, because that is all the scan needs to record. These turn one
 * back into the feed's terms, which is only worth doing for a journey that is returned.
 */

/**
 * The stop the connection was boarded at
 */
export function originIndexOf(network: Network, [route, , from]: Connection): StopIdx {
  const { stopOffsets, stops } = network.timetable.routes;

  return stops[stopOffsets[route] + from];
}

/**
 * The stop the connection was boarded at, as the feed names it
 */
export function originOf(network: Network, connection: Connection): StopID {
  return network.stopIds[originIndexOf(network, connection)];
}

/**
 * The feed's trip the connection was made on
 */
export function tripOf(network: Network, [, trip]: Connection): Trip {
  return network.trips[trip];
}

/**
 * The stop times the connection covers, from the call boarded at to the call alighted at,
 * including the passing points between them.
 */
export function stopTimesOf(network: Network, connection: Connection): StopTime[] {
  const trip = tripOf(network, connection);
  const [, , from, to] = connection;

  return trip.stopTimes.slice(callAt(trip, from), callAt(trip, to) + 1);
}

/**
 * When the connection departs the stop it was boarded at
 */
export function departureOf(network: Network, connection: Connection): Time {
  const trip = tripOf(network, connection);

  return trip.stopTimes[callAt(trip, connection[2])].departureTime;
}
