import { describe, it, expect } from "vitest";
import { createNetwork } from "../../../src/raptor/Network";
import { DROP_OFF, PICK_UP, type Timetable } from "../../../src/raptor/Timetable";
import { feed, st, t, tf } from "../util";
import type { Stop, StopID, StopIndex } from "../../../src/gtfs/GTFS";

function transfersFrom(timetable: Timetable, stop: number): { destination: number, duration: number }[] {
  const { offsets, destination, duration } = timetable.transfers;

  return [...Array(offsets[stop + 1] - offsets[stop])].map((_, i) => ({
    destination: destination[offsets[stop] + i],
    duration: duration[offsets[stop] + i]
  }));
}

function routeCount(timetable: Timetable): number {
  return timetable.routes.tripOffsets.length - 1;
}

function tripsOnRoute(timetable: Timetable, route: number): number {
  return timetable.routes.tripOffsets[route + 1] - timetable.routes.tripOffsets[route];
}

describe("Network", () => {

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

  function indexStops(...stops: Stop[]): StopIndex {
    return stops.reduce((all, s) => { all[s.id] = s; return all; }, {} as StopIndex);
  }

  it("assigns a dense index to every stop", () => {
    const { stopIds, stopIndex } = createNetwork(feed([t(st("A", null, 1000), st("B", 1100, null))]));

    expect(stopIds.length).toBe(2);
    expect(stopIds).toEqual(["A", "B"]);
    expect(stopIndex.get("A")).toBe(0);
    expect(stopIndex.get("B")).toBe(1);
  });

  it("groups trips calling at the same stops into one route", () => {
    const { timetable } = createNetwork(feed([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("B", 2100, null))
    ]));

    expect(routeCount(timetable)).toBe(1);
    expect(tripsOnRoute(timetable, 0)).toBe(2);
    expect(timetable.routes.stopOffsets[1] - timetable.routes.stopOffsets[0]).toBe(2);
  });

  it("separates trips calling at different stops into different routes", () => {
    const { timetable } = createNetwork(feed([
      t(st("A", null, 1000), st("B", 1100, null)),
      t(st("A", null, 2000), st("C", 2100, null))
    ]));

    expect(routeCount(timetable)).toBe(2);
  });

  it("separates an overtaking trip into its own route", () => {
    const { timetable } = createNetwork(feed([
      // departs first but arrives second, so the second trip overtakes it
      t(st("A", null, 1000), st("B", 3000, null)),
      t(st("A", null, 2000), st("B", 2500, null))
    ]));

    expect(routeCount(timetable)).toBe(2);
    expect(tripsOnRoute(timetable, 0)).toBe(1);
    expect(tripsOnRoute(timetable, 1)).toBe(1);
  });

  it("lays the stop times out trip-major within each route", () => {
    const { timetable } = createNetwork(feed([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("A", null, 2000), st("B", 2100, 2150), st("C", 2200, null))
    ]));

    const { arrivals, departures, stopOffsets, stopTimesBase } = timetable.routes;
    const numStops = stopOffsets[1] - stopOffsets[0];

    expect(numStops).toBe(3);
    expect(Array.from(arrivals)).toEqual([1000, 1100, 1200, 2000, 2100, 2200]);
    expect(Array.from(departures)).toEqual([1000, 1150, 1200, 2000, 2150, 2200]);

    // second trip, third stop
    expect(arrivals[stopTimesBase[0] + 1 * numStops + 2]).toBe(2200);
  });

  it("records where each route picks up and sets down", () => {
    const { timetable } = createNetwork(feed([
      t(st("A", null, 1000), st("B", null, 1150), st("C", 1200, null))
    ]));

    expect(Array.from(timetable.routes.stops)).toEqual([0, 1, 2]);
    expect(Array.from(timetable.routes.flags)).toEqual([PICK_UP, PICK_UP, DROP_OFF]);
  });

  it("indexes the routes picking up at each stop, and where in the route they call", () => {
    const { timetable, stopIndex } = createNetwork(feed([
      t(st("A", null, 1000), st("B", 1100, 1150), st("C", 1200, null)),
      t(st("B", null, 2000), st("C", 2100, null))
    ]));

    const routesAt = (stop: number) => {
      const base = timetable.routesByStop.offsets[stop];
      const count = timetable.routesByStop.offsets[stop + 1] - base;

      return Array.from({ length: count }, (_, i) => [
        timetable.routesByStop.route[base + i],
        timetable.routesByStop.position[base + i]
      ]);
    };

    // A is only picked up at, at position 0 of route 0
    expect(routesAt(stopIndex.get("A") as number)).toEqual([[0, 0]]);
    // B is picked up at position 1 of route 0 and position 0 of route 1
    expect(routesAt(stopIndex.get("B") as number)).toEqual([[0, 1], [1, 0]]);
    // C is a set down only stop, so no route picks up there
    expect(routesAt(stopIndex.get("C") as number)).toEqual([]);
  });

  it("queues a route from the first call at a stop it visits twice", () => {
    // A is called at twice, so a scan starting from A must start at the first call, not the second
    const { timetable, stopIndex } = createNetwork(feed([
      t(st("A", null, 1000), st("B", 1100, 1150), st("A", 1200, 1250), st("C", 1300, null))
    ]));

    const stop = stopIndex.get("A") as number;
    const base = timetable.routesByStop.offsets[stop];

    expect(timetable.routesByStop.offsets[stop + 1] - base).toBe(1);
    expect(timetable.routesByStop.route[base]).toBe(0);
    expect(timetable.routesByStop.position[base]).toBe(0);
  });

  it("resolves transfer destinations to stop indexes", () => {
    const { timetable, stopIndex } = createNetwork(feed(
      [t(st("A", null, 1000), st("B", 1100, null))],
      { A: [tf("A", "B", 120)] },
      {},
      {}
    ));

    const from = stopIndex.get("A") as number;

    expect(transfersFrom(timetable, from)).toEqual([{ destination: stopIndex.get("B"), duration: 120 }]);
  });

  it("interns stops that are only reachable by transfer", () => {
    const { timetable, stopIds, stopIndex } = createNetwork(feed(
      [t(st("A", null, 1000), st("B", 1100, null))],
      { B: [tf("B", "C", 120)] },
      {},
      {}
    ));

    expect(stopIds).toEqual(["A", "B", "C"]);
    expect(transfersFrom(timetable, stopIndex.get("B") as number)[0].destination)
      .toBe(stopIndex.get("C"));
  });

  it("defaults the interchange time to zero", () => {
    const { timetable, stopIndex } = createNetwork(feed(
      [t(st("A", null, 1000), st("B", 1100, null))],
      {},
      { B: 300 },
      {}
    ));

    expect(timetable.interchange[stopIndex.get("A") as number]).toBe(0);
    expect(timetable.interchange[stopIndex.get("B") as number]).toBe(300);
  });

  it("names a stop by the code of the station it belongs to", () => {
    const { stopIds } = createNetwork(feed(
      [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))],
      {},
      {},
      indexStops(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1),
        stop("9100DISS1", "DIS", 0, "910GDISS")
      )
    ));

    expect(stopIds).toEqual(["NRW", "DIS"]);
  });

  it("leaves the platform on the feed's stop time", () => {
    const { trips } = createNetwork(feed(
      [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))],
      {},
      {},
      indexStops(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1),
        stop("9100DISS1", "DIS", 0, "910GDISS")
      )
    ));

    expect(trips[0].stopTimes.map(s => s.stop)).toEqual(["9100NRCH4", "9100DISS1"]);
  });

  it("walks up through every level of grouping", () => {
    const { stopIds } = createNetwork(feed(
      [t(st("9100NRCH4A", null, 1000), st("910GDISS", 1030, null))],
      {},
      {},
      indexStops(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("9100NRCH4A", "NRW", 4, "9100NRCH4"),
        stop("910GDISS", "DIS", 1)
      )
    ));

    expect(stopIds).toEqual(["NRW", "DIS"]);
  });

  it("falls back to the id of a stop with no code", () => {
    const { stopIds } = createNetwork(feed(
      [t(st("NRW", null, 1000), st("DIS", 1030, null))],
      {},
      {},
      indexStops(stop("NRW", undefined), stop("DIS", undefined))
    ));

    expect(stopIds).toEqual(["NRW", "DIS"]);
  });

  it("stops walking rather than following a parent that is not in the feed", () => {
    const { stopIds } = createNetwork(feed(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      {},
      {},
      indexStops(stop("9100NRCH4", "NRW", 0, "910GNRCH"), stop("910GDISS", "DIS", 1))
    ));

    expect(stopIds).toEqual(["NRW", "DIS"]);
  });

  it("rejects two stations sharing a code, which would plan them as one place", () => {
    const stops = indexStops(stop("910GNRCH", "NRW", 1), stop("910GNRWICH", "NRW", 1));

    expect(() => createNetwork(feed([], {}, {}, stops)))
      .toThrow(/910GNRCH and 910GNRWICH both have the stop_code NRW/);
  });

  it("allows the platforms of a station to share its code", () => {
    const stops = indexStops(
      stop("910GNRCH", "NRW", 1),
      stop("9100NRCH4", "NRW", 0, "910GNRCH"),
      stop("9100NRCH5", "NRW", 0, "910GNRCH")
    );

    expect(() => createNetwork(feed([], {}, {}, stops))).not.toThrow();
  });

  it("plans with the calls a passenger can use, leaving the passing points on the trip", () => {
    const passing = st("PAS", 1015, 1015);
    passing.pickUp = false;
    passing.dropOff = false;

    const { stopIds, trips } = createNetwork(feed(
      [t(st("NRW", null, 1000), passing, st("DIS", 1030, null))],
      {},
      {},
      {}
    ));

    expect(stopIds).toEqual(["NRW", "DIS"]);
    expect(trips[0].stopTimes.map(s => s.stop)).toEqual(["NRW", "PAS", "DIS"]);
  });

  it("drops a trip that cannot be both boarded and alighted", () => {
    const { trips } = createNetwork(feed(
      [t(st("NRW", null, 1000), st("DIS", 1030, null)), t(st("NRW", null, 1000))],
      {},
      {},
      {}
    ));

    expect(trips.length).toBe(1);
  });

  it("moves transfers and interchange onto the station", () => {
    const { timetable, stopIndex } = createNetwork(feed(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      { "9100NRCH4": [tf("9100NRCH4", "910GDISS", 300)] },
      { "910GNRCH": 600 },
      indexStops(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1)
      )
    ));

    const from = stopIndex.get("NRW") as number;

    expect(timetable.interchange[from]).toBe(600);
    expect(transfersFrom(timetable, from)[0].destination).toBe(stopIndex.get("DIS"));
  });

  it("drops a transfer between two platforms of one station", () => {
    const { timetable, stopIndex } = createNetwork(feed(
      [t(st("9100NRCH4", null, 1000), st("910GDISS", 1030, null))],
      { "9100NRCH4": [tf("9100NRCH4", "9100NRCH5", 300)] },
      {},
      indexStops(
        stop("910GNRCH", "NRW", 1),
        stop("9100NRCH4", "NRW", 0, "910GNRCH"),
        stop("9100NRCH5", "NRW", 0, "910GNRCH"),
        stop("910GDISS", "DIS", 1)
      )
    ));

    expect(transfersFrom(timetable, stopIndex.get("NRW") as number)).toEqual([]);
  });

  it("leaves the feed's trips exactly as it found them", () => {
    const trips = [t(st("9100NRCH4", null, 1000), st("9100DISS1", 1030, null))];
    const stops = indexStops(
      stop("910GNRCH", "NRW", 1),
      stop("9100NRCH4", "NRW", 0, "910GNRCH"),
      stop("910GDISS", "DIS", 1),
      stop("9100DISS1", "DIS", 0, "910GDISS")
    );

    const once = createNetwork(feed(trips, {}, {}, stops));
    const twice = createNetwork(feed(trips, {}, {}, stops));

    expect(twice.stopIds).toEqual(once.stopIds);
    // the trip still calls at the feed's stops, not the stations the algorithm planned with
    expect(trips[0].stopTimes.map(s => s.stop)).toEqual(["9100NRCH4", "9100DISS1"]);
  });

});
