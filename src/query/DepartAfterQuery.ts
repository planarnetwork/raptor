import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { StopID, Time } from "../gtfs/GTFS";
import { ResultsFactory } from "../results/ResultsFactory";
import { Journey } from "../results/Journey";
import { GroupStationDepartAfterQuery } from "./GroupStationDepartAfterQuery";

/**
 * Implementation of Raptor that searches for journeys departing after a specific time.
 *
 * Only returns results from a single pass of the Raptor algorithm.
 */
export class DepartAfterQuery {

  private readonly groupQuery: GroupStationDepartAfterQuery;

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory,
    private readonly maxSearchDays: number = 3
  ) {
    this.groupQuery = new GroupStationDepartAfterQuery(raptor, resultsFactory, maxSearchDays);
  }

  /**
   * Plan a journey between the origin and destination on the given date and time.
   *
   * This method delegates the call to a GroupStationDepartAfterQuery where the origin and
   * destination sets are just a single station.
   *
   * No filters are applied.
   */
  public plan(origin: StopID, destination: StopID, date: Date, time: Time): Journey[] {
    return this.groupQuery.plan([origin], [destination], date, time);
  }

}
