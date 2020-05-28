import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID } from "../gtfs/GTFS";
import { getDateNumber } from "./DateUtil";
import { StringResults, TransferPatternIndex } from "../transfer-pattern/results/StringResults";

/**
 * Uses the Raptor algorithm to perform full day range queries and send the results to the repository.
 */
export class TransferPatternQuery {
  private readonly ONE_DAY = 24 * 60 * 60;

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultFactory: () => StringResults,
  ) {}

  /**
   * Generate generate a full day's set of results and store them using the resultsFactory
   */
  public plan(origin: StopID, dateObj: Date): TransferPatternIndex {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const results = this.resultFactory();
    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan({ [origin]: time }, date, dayOfWeek);

      time = results.add(kConnections);
    }

    return results.finalize();
  }

}
