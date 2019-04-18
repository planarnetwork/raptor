import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { ResultsFactory } from "../results/ResultsFactory";
import { DayOfWeek, StopID } from "../gtfs/GTFS";
import { getDateNumber } from "./DateUtil";
import { Journey } from "../results/Journey";
import { JourneyFilter } from "../results/filter/JourneyFilter";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RangeQuery {

  private readonly ONE_DAY = 24 * 60 * 60;

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory,
    private readonly filters: JourneyFilter[] = []
  ) {}

  /**
   * Perform a query at midnight, and then continue to search one minute after the earliest departure of each set of
   * results.
   */
  public plan(
    origin: StopID,
    destination: StopID,
    dateObj: Date,
    time: number = 1,
    endTime: number = this.ONE_DAY
  ): Journey[] {

    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const results: Journey[] = [];

    while (time < endTime) {
      const kConnections = this.raptor.scan([origin], date, dayOfWeek, time);
      const newResults = this.resultsFactory.getResults(kConnections, destination);

      results.push(...newResults);

      if (newResults.length === 0) {
        break;
      }

      time = Math.min(...newResults.map(j => j.departureTime)) + 1;
    }

    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }

}
