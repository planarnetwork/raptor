import { isTransfer, type Connection, type ConnectionIndex } from "../../raptor/Connection.js";
import type { Network } from "../../network/Network.js";
import { originIndexOf } from "../../raptor/Connection.js";
import type { StopIdx } from "../../network/Timetable.js";
import type { Time } from "@gb-transit/gtfs-loader";
import type { Path } from "./TransferPatternResults.js";

/**
 * Store the kConnection results as an index where the key is the journey origin and destination and the value is a Set
 * of change points.
 */
export class StringResults {
  private results: TransferPatternIndex = {};

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

      // the interchange the scan added on arriving here, which the network holds already resolved
      // to a station and defaulted. The feed's own interchange is keyed by its stop ids, so it
      // cannot be looked up by the station a transfer names
      departureTime = transfer
          ? departureTime - transfer.duration - network.timetable.interchange[destination]
          : this.departureOf(network, connection as Connection);

      path.unshift(network.stopIds[origin]);

      destination = origin;
    }

    return [path, departureTime];
  }

  /**
   * When the connection departs the stop it was boarded at.
   *
   * Read from the timetable rather than the feed's stop times, which hold the same departure but
   * only after the calls have been counted past the passing points. It is the same value either
   * way, and taking it from the timetable is what lets a pattern be built without the feed, so a
   * worker can share a timetable rather than load a feed of its own.
   */
  private departureOf(network: Network, [route, trip, from]: Connection): Time {
    const { stopOffsets, stopTimesBase, tripOffsets, departures } = network.timetable.routes;
    const stopsInRoute = stopOffsets[route + 1] - stopOffsets[route];

    return departures[stopTimesBase[route] + (trip - tripOffsets[route]) * stopsInRoute + from];
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
