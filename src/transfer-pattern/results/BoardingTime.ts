import { callAt } from "../../gtfs/Calls";
import type { Network } from "../../raptor/Network";
import type { Connection } from "../../raptor/ScanResults";

/**
 * When the leg departs the stop it was boarded at
 */
export function boardingTime(network: Network, [, trip, from]: Connection): number {
  const feedTrip = network.trips[trip];

  return feedTrip.stopTimes[callAt(feedTrip, from)].departureTime;
}
