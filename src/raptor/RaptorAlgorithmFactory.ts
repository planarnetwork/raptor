import type { DayOfWeek } from "../gtfs/GTFS";
import type { GTFSFeed } from "../gtfs/GTFSLoader";
import { RaptorAlgorithm } from "./RaptorAlgorithm";
import { getDateNumber } from "../query/DateUtil";
import { createTimetable } from "./Timetable";

/**
 * Prepares GTFS data for the raptor algorithm
 */
export class RaptorAlgorithmFactory {

  /**
   * Set up the indexes the algorithm needs. If a date is given the trips are filtered to those
   * running on it first, which makes planning faster at the cost of only being able to plan for
   * that date.
   */
  public static create(feed: GTFSFeed, date?: Date): RaptorAlgorithm {
    if (date) {
      const dateNumber = getDateNumber(date);
      const dow = date.getDay() as DayOfWeek;

      feed = { ...feed, trips: feed.trips.filter(trip => trip.service.runsOn(dateNumber, dow)) };
    }

    return new RaptorAlgorithm(createTimetable(feed));
  }
}
