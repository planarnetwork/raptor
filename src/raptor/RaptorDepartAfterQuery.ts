import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {DayOfWeek, StopID, Time} from "../gtfs/GTFS";
import {ResultsFactory} from "../results/ResultsFactory";

export class RaptorDepartAfterQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: StopID, destination: StopID, dateObj: Date, departureTime: Time): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const kConnections = this.raptor.scan(origin, destination, date, dayOfWeek, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }
}
