import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID } from "../gtfs/GTFS";
import { getDateNumber } from "./DateUtil";
import { TransferPatternResultsFactory } from "../transfer-pattern/results/TransferPatternResults";

/**
 * Uses the Raptor algorithm to perform full day range queries and send the results to the repository.
 */
export class TransferPatternQuery<T> {
  private readonly ONE_DAY = 24 * 60 * 60;

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultFactory: TransferPatternResultsFactory<T>,
  ) {}

  /**
   * Generate generate a full day's set of results and store them using the resultsFactory
   */
  public plan(origin: StopID, dateObj: Date): T {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const results = this.resultFactory();
    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan({ [origin]: time }, date, dayOfWeek);

      results.add(kConnections);

      time += 5 * 60; // todo get earliest departure at the origin
    }

    return results.finalize();
  }

}
