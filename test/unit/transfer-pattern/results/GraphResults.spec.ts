import { describe, it, expect } from "vitest";
import type { Network } from "../../../../src/raptor/Network";
import type { ConnectionIndex } from "../../../../src/raptor/ScanResults";
import {GraphResults} from "../../../../src/transfer-pattern/results/GraphResults";
import type {StopID} from "../../../../src/gtfs/GTFS";

describe("GraphResults", () => {

  it("Merges a path into an empty tree", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B", "C"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

  it("Merges duplicate paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B", "C"], tree);
    mergePath(["A", "B"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

  it("Appends to existing paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B"], tree);
    mergePath(["A", "B", "C"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

  it("Appends different paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };
    const D = { label: "D", parent: C };
    const D1 = { label: "D", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C],
      "D": [D, D1]
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "B", "D"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

});

function mergePath(path: StopID[], tree: GraphResults): void {
  const kConnections: ConnectionIndex = {};
  const stopIds: StopID[] = [];
  const stopIndex = new Map<StopID, number>();
  const routeStops: number[] = [];

  const intern = (stop: StopID): number => {
    let index = stopIndex.get(stop);

    if (index === undefined) {
      index = stopIds.length;
      stopIndex.set(stop, index);
      stopIds.push(stop);
    }

    return index;
  };

  const trips: unknown[] = [];

  // each step of the path is a route of its own, boarded at position 0 and alighted at position 1
  for (let i = 1; i < path.length; i++) {
    routeStops.push(intern(path[i - 1]), intern(path[i]));
    kConnections[path[i]] = { [i]: [i - 1, i - 1, 0, 1] };
    trips.push({ stopTimes: [
      { stop: path[i - 1], departureTime: i, arrivalTime: i, pickUp: true, dropOff: false },
      { stop: path[i], departureTime: i, arrivalTime: i, pickUp: false, dropOff: true }
    ] });
  }

  const network = {
    timetable: {
      routes: {
        stopOffsets: Int32Array.from({ length: path.length }, (_, route) => route * 2),
        stops: Int32Array.from(routeStops)
      }
    },
    stopIds,
    trips,
    transfers: []
  } as unknown as Network;

  tree.add(kConnections, network);
}
