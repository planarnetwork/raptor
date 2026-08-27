import type { StopTime, Trip } from "./GTFS";

/**
 * A call a passenger can use, as opposed to a point the vehicle only passes through
 */
export function isCall(stopTime: StopTime): boolean {
  return stopTime.pickUp || stopTime.dropOff;
}

/**
 * Where in the trip's stop times the given call is.
 *
 * The algorithm numbers the calls of a route from zero, skipping the passing points, so position
 * `p` is the `p + 1`th usable call. Nothing has to be stored to undo that, since whether a stop
 * time is a call is a property of the stop time.
 */
export function callAt(trip: Trip, position: number): number {
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

/**
 * The stop times the leg covers, from the call boarded at to the call alighted at, including the
 * passing points between them.
 */
export function stopTimesBetween(trip: Trip, from: number, to: number): StopTime[] {
  return trip.stopTimes.slice(callAt(trip, from), callAt(trip, to) + 1);
}
