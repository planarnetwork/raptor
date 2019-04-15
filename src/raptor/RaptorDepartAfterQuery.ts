import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {DayOfWeek, StopID, Time} from "../gtfs/GTFS";
import {ResultsFactory} from "../results/ResultsFactory";
import { keyValue } from "ts-array-utils";

export class RaptorDepartAfterQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: StopID[],
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: StopID, destination: StopID, dateObj: Date, departureTime: Time): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const { kConnections } = this.raptor.scan(bestArrivals, origin, date, dayOfWeek, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }
}
