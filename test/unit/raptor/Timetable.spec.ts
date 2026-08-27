import { describe, it, expect } from "vitest";
import { createTimetable, DROP_OFF, PICK_UP } from "../../../src/raptor/Timetable";
import { st, t, tf } from "../util";
import type { Stop, StopID, StopIndex } from "../../../src/gtfs/GTFS";

describe("Timetable", () => {

  function stop(id: StopID, code: string | undefined, locationType = 0, parentStation?: StopID): Stop {
    return {
      id,
      code: code as string,
      name: id,
      description: "",
      latitude: 0,
      longitude: 0,
      timezone: "Europe/London",
      locationType,
      parentStation
    };
  }

  function stopIndex(...stops: Stop[]): StopIndex {
    return stops.reduce((all, s) => { all[s.id] = s; return all; }, {} as StopIndex);
  }

  it("assigns a dense index to every stop", () => {
    const timetable = createTimetable([t(st("A", null, 1000), st("B", 1100, null))], {}, {}, {});

    expect(timetable.stopIds.length).toBe(2);
    expect(timetable.stopIds).toEqual(["A", "B"]);
    expect(timetable.stopIndex.get("A")).toBe(0);
    expect(timetable.stopIndex.get("B")).toBe(1);
  });

  it("groups trips calling at the same stops into one route", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("B", 2100, null))
    ], {}, {}, {});

    expect(timetable.routes.trips.length).toBe(1);
    expect(timetable.routes.trips[0].length).toBe(2);
    expect(timetable.routes.stopOffsets[1] - timetable.routes.stopOffsets[0]).toBe(2);
  });

  it("separates trips calling at different stops into different routes", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("C", 2100, null))
    ], {}, {}, {});

    expect(timetable.routes.trips.length).toBe(2);
  });

  it("separates an overtaking trip into its own route", () => {
    const timetable = createTimetable([
      // departs first but arrives second, so the second trip overtakes it
      t(st("A", null, 1000), st("B", 3000, null)),
      t(st("A", null, 2000), st("B", 2500, null))
    ], {}, {}, {});

    expect(timetable.routes.trips.length).toBe(2);
    expect(timetable.routes.trips[0].length).toBe(1);
    expect(timetable.routes.trips[1].length).toBe(1);
  });

  it("lays the stop times out trip-major within each route", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("A", null, 2000), st("B", 2100, 2150), st("C", 2200, null))
    ], {}, {}, {});

    const { arrivals, departures, stopOffsets, stopTimesBase } = timetable.routes;
    const numStops = stopOffsets[1] - stopOffsets[0];

    expect(numStops).toBe(3);
    expect(Array.from(arrivals)).toEqual([1000, 1100, 1200, 2000, 2100, 2200]);
    expect(Array.from(departures)).toEqual([1000, 1150, 1200, 2000, 2150, 2200]);

    // second trip, third stop
    expect(arrivals[stopTimesBase[0] + 1 * numStops + 2]).toBe(2200);
  });

  it("records where each route picks up and sets down", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", null, 1150), st("C", 1200, null))
    ], {}, {}, {});

    expect(Array.from(timetable.routes.stops)).toEqual([0, 1, 2]);
    expect(Array.from(timetable.routes.flags)).toEqual([PICK_UP, PICK_UP, DROP_OFF]);
  });

  it("indexes the routes picking up at each stop, and where in the route they call", () => {
    const timetable = createTimetable([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("B", null, 2000), st("C", 2100, null))
    ], {}, {}, {});

    const routesAt = (stop: number) => {
      const base = timetable.routesByStop.offsets[stop];
      const count = timetable.routesByStop.offsets[stop + 1] - base;

      return Array.from({ length: count }, (_, i) => [
        timetable.routesByStop.route[base + i],
        timetable.routesByStop.position[base + i]
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
    ], {}, {}, {});

    const stop = timetable.stopIndex.get("A") as number;
    const base = timetable.routesByStop.offsets[stop];

    expect(timetable.routesByStop.offsets[stop + 1] - base).toBe(1);
    expect(timetable.routesByStop.route[base]).toBe(0);
    expect(timetable.routesByStop.position[base]).toBe(0);
  });

  it("resolves transfer destinations to stop indexes", () => {
    const transfer = tf("A", "B", 120);
    const timetable = createTimetable(
      [t(st("A", null, 1000), st("B", 1100, null))],
      { A: [transfer] },
      {},
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
      {},
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
      { B: 300 },
      {}
    );

    expect(timetable.interchange[timetable.stopIndex.get("A") as number]).toBe(0);
    expect(timetable.interchange[timetable.stopIndex.get("B") as number]).toBe(300);
  });

  it("names a stop by the code of the station it belongs to", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))],
      {},
      {},
      stopIndex(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1),
        stop("9100DISS1", "DIS", 0, "910GDISS")
      )
    );

    expect(timetable.stopIds).toEqual(["NRW", "DIS"]);
  });

  it("keeps the feed's stop on the stop time as the platform", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))],
      {},
      {},
      stopIndex(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1),
        stop("9100DISS1", "DIS", 0, "910GDISS")
      )
    );

    expect(timetable.routes.trips[0][0].stopTimes.map(s => s.platformStop))
      .toEqual(["9100NRCH4", "9100DISS1"]);
  });

  it("walks up through every level of grouping", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4A", null, 1000), st("910GDISS", 1030, null))],
      {},
      {},
      stopIndex(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("9100NRCH4A", "NRW", 4, "9100NRCH4"),
        stop("910GDISS", "DIS", 1)
      )
    );

    expect(timetable.stopIds).toEqual(["NRW", "DIS"]);
  });

  it("falls back to the id of a stop with no code", () => {
    const timetable = createTimetable(
      [t(st("NRW", null, 1000), st("DIS", 1030, null))],
      {},
      {},
      stopIndex(stop("NRW", undefined), stop("DIS", undefined))
    );

    expect(timetable.stopIds).toEqual(["NRW", "DIS"]);
  });

  it("stops walking rather than following a parent that is not in the feed", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      {},
      {},
      stopIndex(stop("9100NRCH4", "NRW", 0, "910GNRCH"), stop("910GDISS", "DIS", 1))
    );

    expect(timetable.stopIds).toEqual(["NRW", "DIS"]);
  });

  it("rejects two stations sharing a code, which would plan them as one place", () => {
    const stops = stopIndex(stop("910GNRCH", "NRW", 1), stop("910GNRWICH", "NRW", 1));

    expect(() => createTimetable([], {}, {}, stops))
      .toThrow(/910GNRCH and 910GNRWICH both have the stop_code NRW/);
  });

  it("allows the platforms of a station to share its code", () => {
    const stops = stopIndex(
      stop("910GNRCH", "NRW", 1),
      stop("9100NRCH4", "NRW", 0, "910GNRCH"),
      stop("9100NRCH5", "NRW", 0, "910GNRCH")
    );

    expect(() => createTimetable([], {}, {}, stops)).not.toThrow();
  });

  it("keeps only the calls a passenger can use, and the rest as allStopTimes", () => {
    const passing = st("PAS", 1015, 1015);
    passing.pickUp = false;
    passing.dropOff = false;

    const timetable = createTimetable(
      [t(st("NRW", null, 1000), passing, st("DIS", 1030, null))],
      {},
      {},
      {}
    );

    expect(timetable.stopIds).toEqual(["NRW", "DIS"]);
    expect(timetable.routes.trips[0][0].allStopTimes?.map(s => s.stop)).toEqual(["NRW", "PAS", "DIS"]);
  });

  it("drops a trip that cannot be both boarded and alighted", () => {
    const timetable = createTimetable(
      [t(st("NRW", null, 1000), st("DIS", 1030, null)), t(st("NRW", null, 1000))],
      {},
      {},
      {}
    );

    expect(timetable.routes.trips.length).toBe(1);
    expect(timetable.routes.trips[0].length).toBe(1);
  });

  it("moves transfers and interchange onto the station", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      { "9100NRCH4": [tf("9100NRCH4", "910GDISS", 300)] },
      { "910GNRCH": 600 },
      stopIndex(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1)
      )
    );

    const from = timetable.stopIndex.get("NRW") as number;

    expect(timetable.interchange[from]).toBe(600);
    expect(timetable.transfers[from][0].destination).toBe(timetable.stopIndex.get("DIS"));
  });

  it("drops a transfer between two platforms of one station", () => {
    const timetable = createTimetable(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      { "9100NRCH4": [tf("9100NRCH4", "9100NRCH5", 300)] },
      {},
      stopIndex(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("9100NRCH5", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1)
      )
    );

    expect(timetable.transfers[timetable.stopIndex.get("NRW") as number]).toEqual([]);
  });

  it("gives the same result when the same trips are used twice", () => {
    const trips = [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))];
    const stops = stopIndex(
      stop("910GNRCH", "NRW", 1),
      stop("9100NRCH4", "NRW", 0, "910GNRCH"),
      stop("910GDISS", "DIS", 1),
      stop("9100DISS1", "DIS", 0, "910GDISS")
    );

    const once = createTimetable(trips, {}, {}, stops);
    const twice = createTimetable(trips, {}, {}, stops);

    expect(twice.stopIds).toEqual(once.stopIds);
    expect(twice.routes.trips[0][0].stopTimes.map(s => s.platformStop))
      .toEqual(["9100NRCH4", "9100DISS1"]);
  });

});
