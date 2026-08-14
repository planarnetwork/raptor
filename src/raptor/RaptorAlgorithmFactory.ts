import type { DayOfWeek, StopIndex, Trip } from "../gtfs/GTFS";
import { type Interchange, RaptorAlgorithm, type TransfersByOrigin } from "./RaptorAlgorithm";
import { getDateNumber } from "../query/DateUtil";
import { createTimetable } from "./Timetable";

/**
 * Prepares GTFS data for the raptor algorithm
 */
export class RaptorAlgorithmFactory {

  /**
   * Set up indexes that are required by the Raptor algorithm. If a date is provided all trips will be pre-filtered
   * before being given to the Raptor class.
   *
   * If a date is passed all trips will be filtered to ensure they run on that date. This improves query performance
   * but reduces flexibility
   *
   * The stop index is what a feed identifying platforms individually is resolved against, and the
   * stations it gives are the stops queries are made with and journeys are returned in.
   */
  public static create(
    trips: Trip[],
    transfers: TransfersByOrigin,
    interchange: Interchange,
    stops: StopIndex,
    date?: Date
  ): RaptorAlgorithm {

    if (date) {
      const dateNumber = getDateNumber(date);
      const dow = date.getDay() as DayOfWeek;

      trips = trips.filter(trip => trip.service.runsOn(dateNumber, dow));
    }

    return new RaptorAlgorithm(createTimetable(trips, transfers, interchange, stops));
  }
}
