import type { DayOfWeek, Trip } from "../gtfs/GTFS";
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
   */
  public static create(
    trips: Trip[],
    transfers: TransfersByOrigin,
    interchange: Interchange,
    date?: Date
  ): RaptorAlgorithm {

    if (date) {
      const dateNumber = getDateNumber(date);
      const dow = date.getDay() as DayOfWeek;

      trips = trips.filter(trip => trip.service.runsOn(dateNumber, dow));
    }

    trips.sort((a, b) => a.stopTimes[0].departureTime - b.stopTimes[0].departureTime);

    return new RaptorAlgorithm(createTimetable(trips, transfers, interchange));
  }
}
