import type { ConnectionIndex } from "../../../../src/raptor/Connection.js";
import { describe, it, expect } from "vitest";
import type { Network } from "../../../../src/network/Network.js";
import {StringResults} from "../../../../src/transfer-pattern/results/StringResults.js";
import type { StopID } from "@gb-transit/gtfs-loader";

describe("StringResults", () => {

  it("Merges duplicate paths", () => {
    const tree = new StringResults();

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
    const tree = new StringResults();

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

  it("keeps a pattern that another pattern runs through", () => {
    const tree = new StringResults();

    mergePath(["A", "B", "D"], tree);
    mergePath(["A", "B", "C", "D"], tree);

    // changing at B and changing at B then C are both ways of getting from A to D
    expect(tree.finalize().AD).toEqual(new Set(["B", "B,C"]));
  });

  it("Adds different paths", () => {
    const tree = new StringResults();
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

  const stopTimesBase: number[] = [];
  const tripOffsets: number[] = [];
  const departures: number[] = [];

  // each step of the path is a route of its own with one trip, boarded at position 0 and alighted
  // at position 1, departing at the step's number
  for (let i = 1; i < path.length; i++) {
    const route = i - 1;

    routeStops.push(intern(path[i - 1]), intern(path[i]));
    kConnections[intern(path[i])] = [];
    kConnections[intern(path[i])][i] = [route, route, 0, 1];
    stopTimesBase.push(route * 2);
    tripOffsets.push(route);
    departures.push(i, i);
  }

  // every stop needs a slot, including any the path only starts from
  for (let stop = 0; stop < stopIds.length; stop++) {
    kConnections[stop] = kConnections[stop] ?? [];
  }

  const network = {
    timetable: {
      routes: {
        stopOffsets: Int32Array.from({ length: path.length }, (_, route) => route * 2),
        stops: Int32Array.from(routeStops),
        stopTimesBase: Int32Array.from(stopTimesBase),
        tripOffsets: Int32Array.from(tripOffsets),
        departures: Int32Array.from(departures)
      },
      interchange: new Int32Array(stopIds.length)
    },
    stopIds,
    stopIndex,
    transfers: []
  } as unknown as Network;

  tree.add(kConnections, network);
}
