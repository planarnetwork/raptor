import type { ConnectionIndex } from "../../raptor/ScanResults";
import { type Network, stopAt } from "../../raptor/Network";
import { isTransfer } from "../../results/ResultsFactory";
import type { StopID } from "../../gtfs/GTFS";
import type { Path, TransferPatternResults } from "./TransferPatternResults";

/**
 * Uses the Raptor algorithm to perform full day range queries and stores the result as a DAG.
 */
export class GraphResults implements TransferPatternResults<TransferPatternGraph> {
  private readonly results: TransferPatternGraph = {};

  /**
   * Generate transfer patterns and store them in a DAG
   */
  public add(kConnections: ConnectionIndex, network: Network): void {

    for (const path of this.getPaths(kConnections, network)) {
      this.mergePath(path);
    }

  }

  /**
   * Return the results
   */
  public finalize(): TransferPatternGraph {
    return this.results;
  }

  private getPaths(kConnections: ConnectionIndex, network: Network): Path[] {
    const results: Path[] = [];

    for (const destination in kConnections) {
      for (const k in kConnections[destination]) {
        results.push(this.getPath(kConnections, k, destination, network));
      }
    }

    return results;
  }

  private getPath(
    kConnections: ConnectionIndex,
    k: string,
    finalDestination: StopID,
    network: Network
  ): Path {
    const path = [finalDestination];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];
      const origin = isTransfer(connection)
        ? network.transfers[connection].origin
        : stopAt(network, connection[0], connection[2]);

      path.push(origin);

      destination = origin;
    }

    return path;
  }

  /**
   * Merge the given path into the transfer pattern graph.
   */
  private mergePath([head, ...tail]: Path): TreeNode {
    this.results[head] = this.results[head] || [];

    let node = this.results[head].find(n => this.isSame(tail, n.parent));

    if (!node) {
      const parent = tail.length > 0 ? this.mergePath(tail) : null;

      node = { label: head, parent: parent };

      this.results[head].push(node);
    }

    return node;
  }

  /**
   * Check whether the given path is the same as the path between the given node and the root node
   */
  private isSame(path: Path, node: TreeNode | null): boolean {
    for (let i = 0; node; i++, node = node.parent) {
      if (node.label !== path[i]) {
        return false;
      }
    }

    return true;
  }

}

/**
 * Leaf nodes indexed by their label
 */
export type TransferPatternGraph = Record<StopID, TreeNode[]>;

/**
 * Graph node that maintains a reference to it's parent node
 */
export type TreeNode = {
  label: StopID,
  parent: TreeNode | null
};
