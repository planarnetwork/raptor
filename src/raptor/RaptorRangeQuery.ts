import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, StopID, Time} from "../gtfs/GTFS";
import { keyValue } from "ts-array-utils";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RaptorRangeQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: StopID[],
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

    let previousArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});

    const journeys = times.flatMap(time => {
      const { kConnections, kArrivals } = this.raptor.scan(previousArrivals, origin, date, dayOfWeek, time);

      previousArrivals = Object.assign(previousArrivals, kArrivals[1]);

      return this.resultsFactory.getResults(kConnections, destination);
    });

    return journeys.reverse();
  }
}
