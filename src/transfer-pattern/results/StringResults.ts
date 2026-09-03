import { isTransfer, type Connection, type ConnectionIndex } from "../../raptor/Connection.js";
import type { Network } from "../../network/Network.js";
import { departureOf, originIndexOf } from "../../raptor/Connection.js";
import type { StopIdx } from "../../network/Timetable.js";
import type { Interchange, Time } from "../../gtfs/GTFS.js";
import type { Path } from "./TransferPatternResults.js";

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

    for (let stop = 0; stop < kConnections.length; stop++) {
      const destination = network.stopIds[stop];

      for (const k in kConnections[stop]) {
        const [path, departureTime] = this.getPath(kConnections, k, stop, network);

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
    finalDestination: StopIdx,
    network: Network
  ): [Path, Time] {
    const path: Path = [];
    let departureTime = Number.MAX_SAFE_INTEGER;

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];
      const transfer = isTransfer(connection) ? network.transfers[connection] : undefined;
      const origin = transfer
        ? (network.stopIndex.get(transfer.origin) as StopIdx)
        : originIndexOf(network, connection as Connection);

      departureTime = transfer
          ? departureTime - transfer.duration - this.interchange[transfer.destination]
          : departureOf(network, connection as Connection);

      path.unshift(network.stopIds[origin]);

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
