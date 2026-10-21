import type { StopID, StopTime, Time, Transfer, Trip } from "@gb-transit/gtfs-loader";

/**
 * Part of a journey, from one place to another
 */
export interface Leg {
  origin: StopID;
  destination: StopID;
}

/**
 * Leg taken on a vehicle, carrying the trip it was taken on and the stop times it covers.
 *
 * The stop times are the feed's own, so they name the platform where the feed identifies one and
 * include the passing points between the stop boarded at and the stop alighted at.
 */
export interface TimetableLeg extends Leg {
  stopTimes: StopTime[];
  trip: Trip;
}

/**
 * A leg
 */
export type AnyLeg = Transfer | TimetableLeg;

/**
 * A journey is a collection of legs.
 *
 * Every time in one counts in seconds from the midnight the journey departed, and keeps counting
 * past a day rather than wrapping, which is how a feed writes an overnight trip anyway: a train
 * leaving at 23:50 and arriving twenty minutes into the next day arrives at 24:10. A duration is
 * therefore always a subtraction, whether or not the journey crosses midnight.
 */
export interface Journey {
  legs: AnyLeg[];
  departureTime: Time,
  arrivalTime: Time
}

/**
 * A leg taken on a vehicle carries the stop times it covers; one taken on foot has none
 */
export function isTimetableLeg(leg: AnyLeg): leg is TimetableLeg {
  return (leg as TimetableLeg).stopTimes !== undefined;
}
