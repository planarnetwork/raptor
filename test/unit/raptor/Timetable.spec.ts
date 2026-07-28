import { describe, it, expect } from "vitest";
import { createTimetable } from "../../../src/raptor/Timetable";
import { st, t, tf } from "../util";

describe("Timetable", () => {

  it("assigns a dense index to every stop", () => {
    const timetable = createTimetable([t(st("A", null, 1000), st("B", 1100, null))], {}, {});

    expect(timetable.stopIds.length).toBe(2);
    expect(timetable.stopIds).toEqual(["A", "B"]);
    expect(timetable.stopIndex.get("A")).toBe(0);
    expect(timetable.stopIndex.get("B")).toBe(1);
  });

  it("groups trips calling at the same stops into one route", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("B", 2100, null))
    ], {}, {});

    expect(timetable.routeTrips.length).toBe(1);
    expect(timetable.routeTrips[0].length).toBe(2);
    expect(timetable.routeStopOffsets[1] - timetable.routeStopOffsets[0]).toBe(2);
  });

  it("separates trips calling at different stops into different routes", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("C", 2100, null))
    ], {}, {});

    expect(timetable.routeTrips.length).toBe(2);
  });

  it("separates an overtaking trip into its own route", () => {
    const timetable = createTimetable([
      // departs first but arrives second, so the second trip overtakes it
      t(st("A", null, 1000), st("B", 3000, null)),
      t(st("A", null, 2000), st("B", 2500, null))
    ], {}, {});

    expect(timetable.routeTrips.length).toBe(2);
    expect(timetable.routeTrips[0].length).toBe(1);
    expect(timetable.routeTrips[1].length).toBe(1);
  });

  it("lays the stop times out trip-major within each route", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("A", null, 2000), st("B", 2100, 2150), st("C", 2200, null))
    ], {}, {});

    const { arrivals, departures, routeStopOffsets, stopTimesBase } = timetable;
    const numStops = routeStopOffsets[1] - routeStopOffsets[0];

    expect(numStops).toBe(3);
    expect(Array.from(arrivals)).toEqual([1000, 1100, 1200, 2000, 2100, 2200]);
    expect(Array.from(departures)).toEqual([1000, 1150, 1200, 2000, 2150, 2200]);

    // second trip, third stop
    expect(arrivals[stopTimesBase[0] + 1 * numStops + 2]).toBe(2200);
  });

  it("records where each route sets down", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", null, 1150), st("C", 1200, null))
    ], {}, {});

    expect(Array.from(timetable.routeStops)).toEqual([0, 1, 2]);
    expect(Array.from(timetable.dropOff)).toEqual([0, 0, 1]);
  });

  it("indexes the routes picking up at each stop, and where in the route they call", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("B", null, 2000), st("C", 2100, null))
    ], {}, {});

    const routesAt = (stop: number) => {
      const base = timetable.stopRouteOffsets[stop];
      const count = timetable.stopRouteOffsets[stop + 1] - base;

      return Array.from({ length: count }, (_, i) => [
        timetable.stopRoutes[base + i],
        timetable.stopRoutePos[base + i]
      ]);
    };

    // A is only picked up at, at position 0 of route 0
    expect(routesAt(timetable.stopIndex.get("A") as number)).toEqual([[0, 0]]);
    // B is picked up at position 1 of route 0 and position 0 of route 1
    expect(routesAt(timetable.stopIndex.get("B") as number)).toEqual([[0, 1], [1, 0]]);
    // C is a set down only stop, so no route picks up there
    expect(routesAt(timetable.stopIndex.get("C") as number)).toEqual([]);
  });

  it("queues a route from the first call at a stop it visits twice", () => {
    // A is called at twice, so a scan starting from A must start at the first call, not the second
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, 1150), st("A", 1200, 1250), st("C", 1300, null))
    ], {}, {});

    const stop = timetable.stopIndex.get("A") as number;
    const base = timetable.stopRouteOffsets[stop];

    expect(timetable.stopRouteOffsets[stop + 1] - base).toBe(1);
    expect(timetable.stopRoutes[base]).toBe(0);
    expect(timetable.stopRoutePos[base]).toBe(0);
  });

  it("resolves transfer destinations to stop indexes", () => {
    const transfer = tf("A", "B", 120);
    const timetable = createTimetable(
      [t(st("A", null, 1000), st("B", 1100, null))],
      { A: [transfer] },
      {}
    );

    const from = timetable.stopIndex.get("A") as number;

    expect(timetable.transfers[from]).toEqual([{
      destination: timetable.stopIndex.get("B"),
      transfer
    }]);
  });

  it("interns stops that are only reachable by transfer", () => {
    const timetable = createTimetable(
      [t(st("A", null, 1000), st("B", 1100, null))],
      { B: [tf("B", "C", 120)] },
      {}
    );

    expect(timetable.stopIds).toEqual(["A", "B", "C"]);
    expect(timetable.transfers[timetable.stopIndex.get("B") as number][0].destination)
      .toBe(timetable.stopIndex.get("C"));
  });

  it("defaults the interchange time to zero", () => {
    const timetable = createTimetable(
      [t(st("A", null, 1000), st("B", 1100, null))],
      {},
      { B: 300 }
    );

    expect(timetable.interchange[timetable.stopIndex.get("A") as number]).toBe(0);
    expect(timetable.interchange[timetable.stopIndex.get("B") as number]).toBe(300);
  });

});
