import {ConnectionIndex, getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {isTransfer} from "../results/ResultsFactory";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {RouteScannerFactory} from "./RouteScanner";

export class TransferPatternGenerator {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: Stop[],
    private readonly routeScannerFactory: RouteScannerFactory,
    private readonly departureTimesAtStop: Record<Stop, Time[]>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public create(origin: Stop, dateObj: Date): TransferPattern {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const results = {};

    for (const time of this.departureTimesAtStop[origin]) {
      const kConnections = this.raptor.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, time);

      for (const path of this.getPaths(kConnections)) {
        mergePath(path, results);
      }
    }

    return results;
  }

  private getPaths(kConnections: ConnectionIndex): Path[] {
    const results: Path[] = [];

    for (const destination in kConnections) {
      for (const k in kConnections[destination]) {
        results.push(this.getPath(kConnections, k, destination));
      }
    }

    return results;
  }

  private getPath(kConnections: ConnectionIndex, k: string, finalDestination: Stop): Path {
    let path = [finalDestination];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];
      const origin = isTransfer(connection) ? connection.origin : connection[0].stopTimes[connection[1]].stop;

      path.push(origin);

      destination = origin;
    }

    return path;
  }

}

/**
 * Merge the given path into the transfer pattern graph.
 */
export function mergePath([head, ...tail]: Path, results: TransferPattern): TreeNode {
  results[head] = results[head] || [];

  let node = results[head].find(n => isSame(tail, n.parent));

  if (!node) {
    const parent = tail.length > 0 ? mergePath(tail, results) : null;

    node = { label: head, parent: parent };

    results[head].push(node);
  }

  return node;
}

/**
 * Check whether the given path is the same as the path between the given node and the root node
 */
function isSame(path: Path, node: TreeNode | null): boolean {
  for (let i = 0; node; i++, node = node.parent) {
    if (node.label !== path[i]) {
      return false;
    }
  }

  return true;
}

type Path = Stop[];

export type TransferPattern = Record<Stop, TreeNode[]>;

export type TreeNode = {
  label: Stop,
  parent: TreeNode | null
};
