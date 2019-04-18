import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID, Time } from "../gtfs/GTFS";
import { ResultsFactory } from "../results/ResultsFactory";
import { getDateNumber } from "./DateUtil";
import { Journey } from "../results/Journey";

/**
 * Implementation of Raptor that searches for journeys departing after a specific time.
 *
 * Only returns results from a single pass of the Raptor algorithm.
 */
export class DepartAfterQuery {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory
  ) {}

  /**
   * Plan a journey between the origin and destination on the given date and time
   */
  public plan(origin: StopID, destination: StopID, dateObj: Date, departureTime: Time): Journey[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const kConnections = this.raptor.scan(origin, date, dayOfWeek, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }
}
