import type { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import type { StopID } from "../gtfs/GTFS";
import { checkCovered, getDateNumber } from "./DateUtil";
import type { StringResults, TransferPatternIndex } from "../transfer-pattern/results/StringResults";

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
    const results = this.resultFactory();

    checkCovered(this.raptor, date);

    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan({ [origin]: time }, date);

      time = results.add(kConnections);
    }

    return results.finalize();
  }

}
