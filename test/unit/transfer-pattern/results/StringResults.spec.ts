import type { ConnectionIndex } from "../../../../src/raptor/Connection";
import { describe, it, expect } from "vitest";
import type { Network } from "../../../../src/network/Network";
import {StringResults} from "../../../../src/transfer-pattern/results/StringResults";
import type {StopID} from "../../../../src/gtfs/GTFS";

describe("StringResults", () => {

  it("Merges duplicate paths", () => {
    const tree = new StringResults({});

    const expected = {
      "AB": new Set([""]),
      "AC": new Set(["B"]),
      "AD": new Set(["B,C"])
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "B", "C"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

  it("Orders results", () => {
    const tree = new StringResults({});

    const expected = {
      "AC": new Set(["B"]),
      "BC": new Set(["", "D"]),
      "CE": new Set(["B"]),
      "CD": new Set([""]),
    };

    mergePath(["C", "B", "A"], tree);
    mergePath(["C", "D", "B"], tree);
    mergePath(["C", "B", "E"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

  it("Adds different paths", () => {
    const tree = new StringResults({});
    const expected = {
      "AC": new Set(["", "B"]),
      "AB": new Set(["", "C"]),
      "AD": new Set(["B,C", "C,B"])
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "C", "B", "D"], tree);

    expect(tree.finalize()).toEqual(expected);
  });

});

function mergePath(path: StopID[], tree: StringResults): void {
  const kConnections: ConnectionIndex = [];
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
    kConnections[intern(path[i])] = [];
    kConnections[intern(path[i])][i] = [i - 1, i - 1, 0, 1];
    trips.push({ stopTimes: [
      { stop: path[i - 1], departureTime: i, arrivalTime: i, pickUp: true, dropOff: false },
      { stop: path[i], departureTime: i, arrivalTime: i, pickUp: false, dropOff: true }
    ] });
  }

  // every stop needs a slot, including any the path only starts from
  for (let stop = 0; stop < stopIds.length; stop++) {
    kConnections[stop] = kConnections[stop] ?? [];
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
