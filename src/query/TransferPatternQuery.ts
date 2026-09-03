import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm.js";
import type { Network } from "../network/Network.js";
import type { StopID } from "../gtfs/GTFS.js";
import { checkCovered } from "../network/TripCalendar.js";
import { getDateNumber } from "./DateUtil.js";
import type { StringResults, TransferPatternIndex } from "../transfer-pattern/results/StringResults.js";

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

    checkCovered(this.network, date);

    const stop = this.network.stopIndex.get(origin);

    // an origin the feed has no stop for is not reachable, which is how the scan treats it too
    if (stop === undefined) {
      return results.finalize();
    }

    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan(new Map([[stop, time]]), date);

      time = results.add(kConnections, this.network);
    }

    return results.finalize();
  }

}
