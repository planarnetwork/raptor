import type { StopID, StopTime, Time, Trip } from "../gtfs/GTFS.js";
import { isCall } from "../gtfs/Normalise.js";
import type { Network } from "../network/Network.js";
import type { RouteIdx, StopIdx } from "../network/Timetable.js";

/**
 * A leg taken on a vehicle: the route, the trip on it, and the positions boarded and alighted at.
 * Four integers, because that is all the scan needs to record.
 */
export type Connection = [route: RouteIdx, trip: number, from: number, to: number];

/**
 * A leg taken on foot, as an index into Network.transfers
 */
export type TransferIdx = number;

/**
 * The connection that gave the best arrival at each stop in each round. Indexed by stop, then
 * sparsely by round, so a stop with no entries was never reached.
 */
export type ConnectionIndex = (Connection | TransferIdx)[][];

/**
 * A leg taken on foot is recorded as an index into the network's transfers, a leg taken on a
 * vehicle as a tuple.
 */
export function isTransfer(connection: Connection | TransferIdx): connection is TransferIdx {
  return typeof connection === "number";
}

/**
 * The rest turn a connection back into the feed's terms, which is only worth doing for a journey
 * that is actually returned.
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

/**
 * Where in the trip's stop times the given call is.
 *
 * The algorithm numbers the calls of a route from zero, skipping the passing points, so position
 * `p` is the `p + 1`th call. Nothing has to be stored to undo that, since whether a stop time is
 * a call is a property of the stop time.
 */
function callAt(trip: Trip, position: number): number {
  let calls = 0;

  for (let i = 0; i < trip.stopTimes.length; i++) {
    if (isCall(trip.stopTimes[i])) {
      if (calls === position) {
        return i;
      }

      calls++;
    }
  }

  return -1;
}
