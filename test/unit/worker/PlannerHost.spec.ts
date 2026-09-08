import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { PlannerHost } from "../../../src/worker/PlannerHost.js";
import type {
  PlainTrip, PlannerCommand, PlannerEvent, PlannerRequest, PlannerResponse
} from "../../../src/worker/Protocol.js";

const FEED = {
  "stops.txt": "stop_id,stop_code,stop_name,stop_lat,stop_lon\nA,AAA,Ayton,1,2\nB,BBB,Beeton,3,4\n",
  "calendar.txt":
    "service_id,start_date,end_date,monday,tuesday,wednesday,thursday,friday,saturday,sunday\n"
    + "s1,20250101,20251231,1,1,1,1,1,1,1\n",
  "agency.txt": "agency_id,agency_name\n=OP,Operator Rail\n",
  "routes.txt": "route_id,agency_id,route_short_name,route_long_name,route_type\nr1,=OP,OPR,Ayton to Beeton,2\n",
  "trips.txt": "trip_id,route_id,service_id,trip_short_name,trip_headsign\nt1,r1,s1,OP1000,Beeton\n",
  "stop_times.txt":
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n"
    + "t1,10:00:00,10:00:00,A,1,0,0\n"
    + "t1,10:30:00,10:30:00,B,2,0,0\n",
  "feed_info.txt": "feed_start_date,feed_end_date,feed_version\n20250101,20251231,1\n",
  "areas.txt": "area_id,area_name\ng1,Ayton and Beeton\n",
  "stop_areas.txt": "area_id,stop_id\ng1,A\ng1,B\n"
};

/** A feed with no areas.txt, which most feeds are */
const UNGROUPED_FEED = {
  ...FEED,
  "areas.txt": undefined,
  "stop_areas.txt": undefined
};

/** A feed that names neither a route nor an operator, which GTFS allows */
const ANONYMOUS_FEED = {
  ...FEED,
  "agency.txt": undefined,
  "routes.txt": undefined,
  "trips.txt": "trip_id,service_id\nt1,s1\n"
};

function feedZip(files: Record<string, string | undefined> = FEED): Uint8Array<ArrayBuffer> {
  const contents: Record<string, Uint8Array> = {};

  for (const [name, text] of Object.entries(files)) {
    if (text !== undefined) {
      contents[name] = strToU8(text);
    }
  }

  return zipSync(contents);
}

/** Drive the host as the worker would, collecting the events it sends along the way */
async function ask(
  host: PlannerHost,
  request: PlannerCommand,
  events: PlannerEvent[] = []
): Promise<PlannerResponse> {
  return host.handle({ ...request, id: 1 } as PlannerRequest, event => events.push(event));
}

async function loaded(): Promise<PlannerHost> {
  const host = new PlannerHost();

  await ask(host, { type: "load", feed: feedZip() });

  return host;
}

describe("PlannerHost", () => {

  it("loads a feed and says what is in it", async () => {
    const response = await ask(new PlannerHost(), { type: "load", feed: feedZip() });

    expect("loaded").toBe(response.type);
    expect(2).toBe(response.type === "loaded" ? response.stops : 0);
    expect(1).toBe(response.type === "loaded" ? response.trips : 0);
  });

  it("reports progress while loading", async () => {
    const events: PlannerEvent[] = [];

    await ask(new PlannerHost(), { type: "load", feed: feedZip() }, events);

    expect(true).toBe(events.length > 0);
    expect("progress").toBe(events[0].type);
  });

  it("fetches a feed from a url itself", async () => {
    // the bytes never cross the boundary in this case, only the url does
    const zip = feedZip();
    const original = globalThis.fetch;

    globalThis.fetch = (async () => new Response(zip)) as typeof fetch;

    try {
      const response = await ask(new PlannerHost(), { type: "load", feed: { url: "https://example.com/gtfs.zip" } });

      expect("loaded").toBe(response.type);
    }
    finally {
      globalThis.fetch = original;
    }
  });

  it("plans a journey", async () => {
    const host = await loaded();
    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    expect("planned").toBe(response.type);

    const journeys = response.type === "planned" ? response.journeys : [];

    expect(1).toBe(journeys.length);
    expect(36000).toBe(journeys[0].departureTime);
    expect(37800).toBe(journeys[0].arrivalTime);
  });

  /**
   * A Service does not survive being posted: its fields would arrive without its methods, which is
   * worse than leaving it out, because the caller cannot tell that it is broken.
   */
  it("does not send the trip's calendar back with a journey", async () => {
    const host = await loaded();
    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    const leg = response.type === "planned" ? response.journeys[0].legs[0] : undefined;
    const trip = (leg as { trip?: Record<string, unknown> })?.trip;

    expect("t1").toBe(trip?.tripId);
    expect("s1").toBe(trip?.serviceId);
    expect(false).toBe(Object.hasOwn(trip as object, "service"));
  });

  /**
   * The route and the two names are the loader's, and cross with the trip because they are data.
   * A caller that has a Trip from loadGTFS reads the same three fields here.
   */
  it("carries the trip's route and its own names across with a leg", async () => {
    const host = await loaded();
    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    const leg = response.type === "planned" ? response.journeys[0].legs[0] : undefined;
    const trip = (leg as { trip?: PlainTrip })?.trip;

    expect("r1").toBe(trip?.routeId);
    expect("OP1000").toBe(trip?.shortName);
    expect("Beeton").toBe(trip?.headsign);
  });

  /**
   * A leg names a route and stops there, so the indexes that turn that id into an operator are sent
   * once with the load rather than denormalised onto every leg of every journey.
   */
  it("sends the routes and agencies of the feed when it loads", async () => {
    const response = await ask(new PlannerHost(), { type: "load", feed: feedZip() });
    const feed = response.type === "loaded" ? response : undefined;
    const route = feed?.routes.r1;

    expect("OPR").toBe(route?.shortName);
    expect("Ayton to Beeton").toBe(route?.longName);
    // the agency id is as the feed wrote it, leading = and all
    expect("=OP").toBe(route?.agencyId);
    expect("Operator Rail").toBe(feed?.agencies[route?.agencyId as string]?.name);
  });

  /**
   * An area is a fares construct and no journey refers to one, but a caller planning between group
   * stations needs its stops, and the feed itself never leaves this side.
   */
  it("sends the areas of the feed when it loads", async () => {
    const response = await ask(new PlannerHost(), { type: "load", feed: feedZip() });
    const area = response.type === "loaded" ? response.areas.g1 : undefined;

    expect("Ayton and Beeton").toBe(area?.name);
    expect(["A", "B"]).toEqual(area?.stops);
  });

  /**
   * Which is what makes a group station plannable. An area names stop ids, as the feed wrote them,
   * and a query is asked in the stations those resolve to - the mapping the stops reply is there to
   * provide. Both come from this one load, so neither needs the zip read a second time.
   */
  it("plans into the stations of an area it sent back", async () => {
    const host = new PlannerHost();
    const load = await ask(host, { type: "load", feed: feedZip() });
    const listed = await ask(host, { type: "stops" });

    const stops = listed.type === "stops" ? listed.stops : [];
    const area = load.type === "loaded" ? load.areas.g1.stops : [];
    const destinations = area.map(id => stops.find(stop => stop.id === id)?.code as string);

    expect(["AAA", "BBB"]).toEqual(destinations);

    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations,
      date: new Date("2025-06-02").getTime(), time: 0
    });

    expect("planned").toBe(response.type);
    expect(1).toBe(response.type === "planned" ? response.journeys.length : 0);
  });

  it("sends no areas for a feed that has none", async () => {
    const response = await ask(new PlannerHost(), { type: "load", feed: feedZip(UNGROUPED_FEED) });

    expect(0).toBe(response.type === "loaded" ? Object.keys(response.areas).length : -1);
  });

  it("plans a feed that names neither a route nor an operator", async () => {
    const host = new PlannerHost();
    const load = await ask(host, { type: "load", feed: feedZip(ANONYMOUS_FEED) });

    expect(0).toBe(load.type === "loaded" ? Object.keys(load.routes).length : -1);
    expect(0).toBe(load.type === "loaded" ? Object.keys(load.agencies).length : -1);

    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    const leg = response.type === "planned" ? response.journeys[0].legs[0] : undefined;
    const trip = (leg as { trip?: PlainTrip })?.trip;

    expect("t1").toBe(trip?.tripId);
    expect(undefined).toBe(trip?.routeId);
  });

  it("returns something that survives being posted", async () => {
    const host = await loaded();
    const response = await ask(host, {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    // structuredClone throws on anything that cannot cross the boundary
    expect(() => structuredClone(response)).not.toThrow();
  });

  it("lists the stops of the loaded feed", async () => {
    const response = await ask(await loaded(), { type: "stops" });
    const stops = response.type === "stops" ? response.stops : [];

    expect(2).toBe(stops.length);
    expect("Ayton").toBe(stops.find(s => s.id === "A")?.name);
  });

  it("says so rather than throwing when asked to plan before a feed is loaded", async () => {
    const response = await ask(new PlannerHost(), {
      type: "plan", origins: ["AAA"], destinations: ["BBB"],
      date: new Date("2025-06-02").getTime(), time: 0
    });

    expect("error").toBe(response.type);
    expect(true).toBe(response.type === "error" && /load request/.test(response.message));
  });

  it("reports a failed load as an error rather than rejecting", async () => {
    const response = await ask(new PlannerHost(), { type: "load", feed: new Uint8Array([1, 2, 3]) });

    expect("error").toBe(response.type);
  });

});
