import type { StopID, StopTime, Time, Transfer, Trip } from "../gtfs/GTFS.js";

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
 * A journey is a collection of legs
 */
export interface Journey {
  legs: AnyLeg[];
  departureTime: Time,
  arrivalTime: Time
}
