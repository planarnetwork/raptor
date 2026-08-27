import type { Connection, ConnectionIndex } from "../../raptor/ScanResults";
import { type Network, stopAt } from "../../raptor/Network";
import { boardingTime } from "./BoardingTime";
import { isTransfer } from "../../results/ResultsFactory";
import type { StopID, Time } from "../../gtfs/GTFS";
import type { Path } from "./TransferPatternResults";
import type { Interchange } from "../../raptor/RaptorAlgorithm";

/**
 * Store the kConnection results as an index where the key is the journey origin and destination and the value is a Set
 * of change points.
 */
export class StringResults {
  private results: TransferPatternIndex = {};

  constructor(
    private readonly interchange: Interchange
  ) { }

  /**
   * Extract the path from each kConnection result and store it in an index
   */
  public add(kConnections: ConnectionIndex, network: Network): number {
    let nextDepartureTime = Number.MAX_SAFE_INTEGER;

    for (const destination in kConnections) {
      for (const k in kConnections[destination]) {
        const [path, departureTime] = this.getPath(kConnections, k, destination, network);

        if (path.length >= 1) {
          const [origin, ...tail] = path;
          const journeyKey = origin > destination ? destination + origin : origin + destination;
          const pathString = origin > destination ? tail.reverse().join(",") : tail.join(",");

          this.results[journeyKey] = this.results[journeyKey] || new Set();
          this.results[journeyKey].add(pathString);
          nextDepartureTime = Math.min(nextDepartureTime, departureTime + 1);
        }
      }
    }

    return nextDepartureTime;
  }

  /**
   * Return the results
   */
  public finalize(): TransferPatternIndex {
    return this.results;
  }

  private getPath(
    kConnections: ConnectionIndex,
    k: string,
    finalDestination: StopID,
    network: Network
  ): [Path, Time] {
    const path: Path = [];
    let departureTime = Number.MAX_SAFE_INTEGER;

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];
      const transfer = isTransfer(connection) ? network.transfers[connection] : undefined;
      const origin = transfer ? transfer.origin : stopAt(network, connection[0], connection[2]);

      departureTime = transfer
          ? departureTime - transfer.duration - this.interchange[transfer.destination]
          : boardingTime(network, connection as Connection);

      path.unshift(origin);

      destination = origin;
    }

    return [path, departureTime];
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
