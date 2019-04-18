import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID, Time } from "../gtfs/GTFS";
import { ResultsFactory } from "../results/ResultsFactory";
import { getDateNumber } from "./DateUtil";
import { Journey } from "../results/Journey";
import { JourneyFilter } from "../results/filter/JourneyFilter";

/**
 * Implementation of Raptor that searches for journeys between a set of origin and destinations.
 *
 * Only returns results from a single pass of the Raptor algorithm.
 */
export class GroupStationDepartAfterQuery {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory,
    private readonly filters: JourneyFilter[] = []
  ) {}

  /**
   * Plan a journey between the origin and destination on the given date and time
   */
  public plan(origins: StopID[], destinations: StopID[], dateObj: Date, departureTime: Time): Journey[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const kConnections = this.raptor.scan(origins, date, dayOfWeek, departureTime);
    const results = destinations.flatMap(destination => this.resultsFactory.getResults(kConnections, destination));

    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }
}
