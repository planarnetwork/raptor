import type { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import type { ResultsFactory } from "../results/ResultsFactory";
import type { StopID } from "../gtfs/GTFS";
import type { Journey } from "../results/Journey";
import type { JourneyFilter } from "../results/filter/JourneyFilter";
import { GroupStationDepartAfterQuery } from "./GroupStationDepartAfterQuery";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RangeQuery {

  private readonly ONE_DAY = 24 * 60 * 60;
  private readonly groupQuery: GroupStationDepartAfterQuery;

  constructor(readonly raptor: RaptorAlgorithm,readonly resultsFactory: ResultsFactory,readonly maxSearchDays: number = 3,
    private readonly filters: JourneyFilter[] = []
  ) {
    this.groupQuery = new GroupStationDepartAfterQuery(raptor, resultsFactory, maxSearchDays);
  }

  /**
   * Perform a query at midnight, and then continue to search one minute after the earliest departure of each set of
   * results.
   */
  public plan(
    origin: StopID,
    destination: StopID,
    date: Date,
    time: number = 1,
    endTime: number = this.ONE_DAY
  ): Journey[] {

    const results: Journey[] = [];

    while (time < endTime) {
      const newResults = this.groupQuery.plan([origin], [destination], date, time);

      results.push(...newResults);

      if (newResults.length === 0) {
        break;
      }

      time = Math.min(...newResults.map(j => j.departureTime)) + 1;
    }

    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }

}
