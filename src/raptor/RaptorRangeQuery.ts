import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, StopID, Time} from "../gtfs/GTFS";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RaptorRangeQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly departureTimesAtStop: Record<StopID, Time[]>,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: StopID, destination: StopID, dateObj: Date): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const times = this.departureTimesAtStop[origin];

    return times.flatMap(time => {
      const kConnections = this.raptor.scan(origin, destination, date, dayOfWeek, time);

      return this.resultsFactory.getResults(kConnections, destination);
    });
  }
}
