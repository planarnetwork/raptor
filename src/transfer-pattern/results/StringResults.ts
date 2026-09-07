import { isTransfer, originIndexOf, type Connection, type ConnectionIndex } from "../../raptor/Connection.js";
import type { Network } from "../../network/Network.js";
import type { StopIdx } from "../../network/Timetable.js";
import type { StopID, Time } from "@gb-transit/gtfs-loader";

/**
 * Store the kConnection results as an index where the key is the journey origin and destination and the value is a Set
 * of change points.
 *
 * A day of scans from one station finds the same patterns over and over: on a national feed some
 * two million paths turn into a few thousand of them. Naming a path costs more than discovering it
 * has been seen before, so the change points are collected into a tree and only turned into
 * strings by finalize, once each.
 */
export class StringResults {
  /** Origin stop, then destination stop, then the change points between them */
  private readonly journeys = new Map<StopID, Map<StopID, PatternNode>>();
  /** Reused by every path, since a path is filed as soon as it has been walked */
  private readonly changePoints: StopID[] = [];

  /**
   * Extract the path from each kConnection result and store it in an index
   */
  public add(kConnections: ConnectionIndex, network: Network): number {
    let nextDepartureTime = Number.MAX_SAFE_INTEGER;

    for (let stop = 0; stop < kConnections.length; stop++) {
      const rounds = kConnections[stop];

      for (let k = 1; k < rounds.length; k++) {
        if (rounds[k] !== undefined) {
          const departureTime = this.record(kConnections, k, stop, network);

          if (departureTime !== undefined) {
            nextDepartureTime = Math.min(nextDepartureTime, departureTime + 1);
          }
        }
      }
    }

    return nextDepartureTime;
  }

  /**
   * Return the results
   */
  public finalize(): TransferPatternIndex {
    const results: TransferPatternIndex = {};

    for (const [origin, destinations] of this.journeys) {
      for (const [destination, pattern] of destinations) {
        const key = origin + destination;

        results[key] = results[key] ?? new Set();
        name(pattern, [], results[key]);
      }
    }

    return results;
  }

  /**
   * Walk back through the connections to the stop the journey started at, file the stops it was
   * boarded at on the way, and return the time it left the first of them.
   *
   * Undefined where the connections lead nowhere, which is the only case the day's next departure
   * should not be taken from.
   */
  private record(
    kConnections: ConnectionIndex,
    k: number,
    finalDestination: StopIdx,
    network: Network
  ): Time | undefined {
    const changePoints = this.changePoints;

    let departureTime = Number.MAX_SAFE_INTEGER;
    let destination = finalDestination;
    let length = 0;

    for (let i = k; i > 0; i--) {
      const connection = kConnections[destination][i];

      if (connection === undefined) {
        break;
      }

      const transfer = isTransfer(connection) ? network.transfers[connection] : undefined;
      const origin = transfer
        ? (network.stopIndex.get(transfer.origin) as StopIdx)
        : originIndexOf(network, connection as Connection);

      // the interchange the scan added on arriving here, which the network holds already resolved
      // to a station and defaulted. The feed's own interchange is keyed by its stop ids, so it
      // cannot be looked up by the station a transfer names
      departureTime = transfer
        ? departureTime - transfer.duration - network.timetable.interchange[destination]
        : departureOf(network, connection as Connection);

      changePoints[length++] = network.stopIds[origin];
      destination = origin;
    }

    if (length === 0) {
      return undefined;
    }

    this.file(changePoints, length, network.stopIds[finalDestination]);

    return departureTime;
  }

  /**
   * File a path under the pair of stops it runs between.
   *
   * changePoints holds the stops it was boarded at, last first, so the stop it departed from is at
   * the end. The pair is ordered by stop id, as the key is, and the tree is descended in the order
   * that key will name the change points in, so nothing has to be reversed later.
   */
  private file(changePoints: StopID[], length: number, arrival: StopID): void {
    const departure = changePoints[length - 1];
    const forwards = departure <= arrival;

    let node = this.patternsBetween(forwards ? departure : arrival, forwards ? arrival : departure);

    if (forwards) {
      for (let i = length - 2; i >= 0; i--) {
        node = descend(node, changePoints[i]);
      }
    }
    else {
      for (let i = 0; i <= length - 2; i++) {
        node = descend(node, changePoints[i]);
      }
    }

    node.end = true;
  }

  private patternsBetween(from: StopID, to: StopID): PatternNode {
    let destinations = this.journeys.get(from);

    if (destinations === undefined) {
      destinations = new Map();
      this.journeys.set(from, destinations);
    }

    let pattern = destinations.get(to);

    if (pattern === undefined) {
      pattern = newNode();
      destinations.set(to, pattern);
    }

    return pattern;
  }

}

/**
 * When the connection departs the stop it was boarded at.
 *
 * Read from the timetable rather than the feed's stop times, which hold the same departure but
 * only after the calls have been counted past the passing points. Taking it from the timetable is
 * what lets a pattern be built without the feed, so a worker can share a timetable rather than
 * load one of its own.
 */
function departureOf(network: Network, [route, trip, from]: Connection): Time {
  const { stopOffsets, stopTimesBase, tripOffsets, departures } = network.timetable.routes;
  const stopsInRoute = stopOffsets[route + 1] - stopOffsets[route];

  return departures[stopTimesBase[route] + (trip - tripOffsets[route]) * stopsInRoute + from];
}

/**
 * Name every pattern at or below this node, adding each to the set
 */
function name(node: PatternNode, changePoints: StopID[], into: Set<JourneyPattern>): void {
  if (node.end) {
    into.add(changePoints.join(","));
  }

  for (const [stop, child] of node.children) {
    changePoints.push(stop);
    name(child, changePoints, into);
    changePoints.pop();
  }
}

function descend(node: PatternNode, stop: StopID): PatternNode {
  let child = node.children.get(stop);

  if (child === undefined) {
    child = newNode();
    node.children.set(stop, child);
  }

  return child;
}

function newNode(): PatternNode {
  return { children: new Map(), end: false };
}

/**
 * A change point of a pattern and the change points that may follow it. `end` marks a pattern that
 * stops here, which a longer one may also run through.
 */
interface PatternNode {
  children: Map<StopID, PatternNode>;
  end: boolean;
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
