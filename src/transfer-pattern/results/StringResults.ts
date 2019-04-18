import { ConnectionIndex } from "../../raptor/RaptorAlgorithm";
import { isTransfer } from "../../results/ResultsFactory";
import { StopID } from "../../gtfs/GTFS";
import { Path, TransferPatternResults } from "./TransferPatternResults";

/**
 * Store the kConnection results as an index where the key is the journey origin and destination and the value is a Set
 * of change points.
 */
export class StringResults implements TransferPatternResults<TransferPatternIndex> {
  private results: TransferPatternIndex = {};

  /**
   * Extract the path from each kConnection result and store it in an index
   */
  public add(kConnections: ConnectionIndex): void {

    for (const destination in kConnections) {
      for (const k in kConnections[destination]) {
        const path = this.getPath(kConnections, k, destination);

        if (path.length > 1) {
          const [origin, ...tail] = path;
          const journeyKey = origin > destination ? destination + origin : origin + destination;
          const pathString = origin > destination ? tail.reverse().join() : tail.join();

          this.results[journeyKey] = this.results[journeyKey] || new Set();
          this.results[journeyKey].add(pathString);
        }
      }
    }

  }

  /**
   * Return the results
   */
  public finalize(): TransferPatternIndex {
    return this.results;
  }

  private getPath(kConnections: ConnectionIndex, k: string, finalDestination: StopID): Path {
    let path: Path = [];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];
      const origin = isTransfer(connection) ? connection.origin : connection[0].stopTimes[connection[1]].stop;

      path.unshift(origin);

      destination = origin;
    }

    return path;
  }

}

/**
 * Origin + destination.
 */
export type JourneyPatternKey = string;

/**
 * Comma separated list of transfer points. The origin and destination stops are omitted.
 */
export type JourneyPattern = string;

/**
 * Transfer pattern strings indexed by their journey key.
 */
export type TransferPatternIndex = Record<JourneyPatternKey, Set<JourneyPattern>>;
