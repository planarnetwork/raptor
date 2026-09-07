import { describe, it, expect } from "vitest";
import type { StopID, Trip, TripLink } from "../../../src/gtfs/GTFS.js";
import { linkTrips } from "../../../src/gtfs/LinkedTrips.js";
import { Service } from "../../../src/gtfs/Service.js";
import { st } from "../util.js";

// 20180101 is a Monday
const MONDAY = 20180101;
const TUESDAY = 20180102;
const allDays = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
const noDays = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
const everyDay = new Service(20180101, 20181231, allDays, {});
const mondays = new Service(20180101, 20181231, { ...noDays, 1: true }, {});
const tuesdays = new Service(20180101, 20181231, { ...noDays, 2: true }, {});

function trip(tripId: string, service: Service, ...stopTimes: Trip["stopTimes"]): Trip {
  return { tripId, serviceId: tripId, stopTimes, service };
}

function link(fromTripId: string, toTripId: string, fromStop?: StopID, toStop?: StopID): TripLink {
  return { fromTripId, toTripId, fromStop, toStop };
}

const platforms = new Map<StopID, StopID>([["B1", "B"], ["B2", "B"]]);
const station = (stop: StopID): StopID => platforms.get(stop) ?? stop;

const at = (t: Trip) => t.stopTimes.map(s => `${s.stop}@${s.arrivalTime}/${s.departureTime}`);

describe("linkTrips", () => {

  it("returns nothing when the feed has no links", () => {
    expect(linkTrips([trip("a", everyDay, st("A", null, 100))], [], station)).toEqual([]);
  });

  it("joins a portion onto the trip it continues as", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, 200));
    const base = trip("b", everyDay, st("B", 250, 300), st("C", 400, null));

    const [linked] = linkTrips([portion, base], [link("p", "b", "B", "B")], station);

    expect(linked.tripId).toBe("p_b");
    expect(at(linked)).toEqual(["A@100/100", "B@200/300", "C@400/400"]);
  });

  it("splits a portion off part way along the trip it continues", () => {
    const base = trip("b", everyDay, st("A", null, 100), st("B", 200, 250), st("C", 400, null));
    const portion = trip("p", everyDay, st("B", 260, 300), st("D", 500, null));

    const [linked] = linkTrips([base, portion], [link("b", "p", "B", "B")], station);

    expect(at(linked)).toEqual(["A@100/100", "B@200/300", "D@500/500"]);
  });

  it("leaves both trips as they are", () => {
    const base = trip("b", everyDay, st("A", null, 100), st("B", 200, 250), st("C", 400, null));
    const portion = trip("p", everyDay, st("B", 260, 300), st("D", 500, null));

    linkTrips([base, portion], [link("b", "p", "B", "B")], station);

    expect(at(base)).toEqual(["A@100/100", "B@200/250", "C@400/400"]);
    expect(at(portion)).toEqual(["B@260/300", "D@500/500"]);
  });

  it("takes set down from the arriving trip and pick up from the departing one", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, null));
    const base = trip("b", everyDay, st("B", null, 300), st("C", 400, null));

    const [linked] = linkTrips([portion, base], [link("p", "b", "B", "B")], station);

    expect(linked.stopTimes[1].dropOff).toBe(true);
    expect(linked.stopTimes[1].pickUp).toBe(true);
  });

  it("matches the coupling on the station rather than the platform", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B1", 200, 200));
    const base = trip("b", everyDay, st("B2", 250, 300), st("C", 400, null));

    const [linked] = linkTrips([portion, base], [link("p", "b", "B1", "B2")], station);

    expect(at(linked)).toEqual(["A@100/100", "B1@200/300", "C@400/400"]);
  });

  it("couples end to end when the link names no stop", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, 200));
    const base = trip("b", everyDay, st("B", 250, 300), st("C", 400, null));

    const [linked] = linkTrips([portion, base], [link("p", "b")], station);

    expect(at(linked)).toEqual(["A@100/100", "B@200/300", "C@400/400"]);
  });

  it("adds a day to a portion that leaves after midnight", () => {
    const base = trip("b", mondays, st("A", null, 75600), st("B", 100800, 100800));
    const portion = trip("p", tuesdays, st("B", 16080, 16080), st("C", 27000, null));

    const [linked] = linkTrips([base, portion], [link("b", "p", "B", "B")], station);

    expect(at(linked)).toEqual(["A@75600/75600", "B@100800/102480", "C@113400/113400"]);
  });

  it("runs on the arriving trip's day when the portion leaves after midnight", () => {
    const base = trip("b", mondays, st("A", null, 75600), st("B", 100800, 100800));
    const portion = trip("p", tuesdays, st("B", 16080, 16080), st("C", 27000, null));

    const [linked] = linkTrips([base, portion], [link("b", "p", "B", "B")], station);

    expect(linked.service.runsOn(MONDAY, 1)).toBe(true);
    expect(linked.service.runsOn(TUESDAY, 2)).toBe(false);
  });

  it("runs only on the days both trips do", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, 200));
    const base = trip("b", mondays, st("B", 250, 300), st("C", 400, null));

    const [linked] = linkTrips([portion, base], [link("p", "b", "B", "B")], station);

    expect(linked.service.runsOn(MONDAY, 1)).toBe(true);
    expect(linked.service.runsOn(TUESDAY, 2)).toBe(false);
  });

  it("makes a trip for each portion of a train that splits more than once", () => {
    const base = trip("b", everyDay, st("A", null, 100), st("B", 200, 250), st("C", 400, null));
    const first = trip("p1", everyDay, st("B", 260, 300), st("D", 500, null));
    const second = trip("p2", everyDay, st("B", 260, 320), st("E", 600, null));

    const linked = linkTrips(
      [base, first, second],
      [link("b", "p1", "B", "B"), link("b", "p2", "B", "B")],
      station
    );

    expect(linked.map(at)).toEqual([
      ["A@100/100", "B@200/300", "D@500/500"],
      ["A@100/100", "B@200/320", "E@600/600"]
    ]);
  });

  it("ignores a link naming a trip the feed does not have", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, 200));

    expect(linkTrips([portion], [link("p", "missing", "B", "B")], station)).toEqual([]);
  });

  it("ignores a link naming a stop neither trip calls at", () => {
    const portion = trip("p", everyDay, st("A", null, 100), st("B", 200, 200));
    const base = trip("b", everyDay, st("B", 250, 300), st("C", 400, null));

    expect(linkTrips([portion, base], [link("p", "b", "Z", "Z")], station)).toEqual([]);
  });

  it("ignores a coupling that a day's shift cannot put in order", () => {
    const base = trip("b", everyDay, st("A", null, 3600), st("B", 108000, 108000));
    const portion = trip("p", everyDay, st("B", 7200, 7200), st("C", 20000, null));

    expect(linkTrips([base, portion], [link("b", "p", "B", "B")], station)).toEqual([]);
  });

});
