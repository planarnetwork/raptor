import {RaptorAlgorithm} from "./RaptorAlgorithm";
import {StopID, Time} from "../gtfs/GTFS";
import {ResultsFactory} from "../results/ResultsFactory";

export class RaptorDepartAfterQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: StopID, destination: StopID, date: Date, departureTime: Time): T[] {
    const kConnections = this.raptor.scan(origin, destination, date, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }
}
