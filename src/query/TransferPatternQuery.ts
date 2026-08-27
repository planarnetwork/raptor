import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import type { Network } from "../network/Network";
import type { StopIdx } from "../network/Timetable";
import type { StopID } from "../gtfs/GTFS";
import { checkCovered, getDateNumber } from "./DateUtil";
import type { StringResults, TransferPatternIndex } from "../transfer-pattern/results/StringResults";

/**
 * Uses the Raptor algorithm to perform full day range queries and send the results to the repository.
 */
export class TransferPatternQuery {
  private readonly ONE_DAY = 24 * 60 * 60;

  private readonly raptor: RaptorAlgorithm;

  constructor(
    private readonly network: Network,
    private readonly resultFactory: () => StringResults,
  ) {
    this.raptor = new RaptorAlgorithm(network.timetable);
  }

  /**
   * Generate generate a full day's set of results and store them using the resultsFactory
   */
  public plan(origin: StopID, dateObj: Date): TransferPatternIndex {
    const date = getDateNumber(dateObj);
    const results = this.resultFactory();

    checkCovered(this.raptor, date);

    const stop = this.network.stopIndex.get(origin) as StopIdx;

    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan(new Map([[stop, time]]), date);

      time = results.add(kConnections, this.network);
    }

    return results.finalize();
  }

}
