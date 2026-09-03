import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { PlannerHost } from "../../../src/worker/PlannerHost.js";
import type { PlannerCommand, PlannerEvent, PlannerRequest, PlannerResponse } from "../../../src/worker/Protocol.js";

const FEED = {
  "stops.txt": "stop_id,stop_code,stop_name,stop_lat,stop_lon\nA,AAA,Ayton,1,2\nB,BBB,Beeton,3,4\n",
  "calendar.txt":
    "service_id,start_date,end_date,monday,tuesday,wednesday,thursday,friday,saturday,sunday\n"
    + "s1,20250101,20251231,1,1,1,1,1,1,1\n",
  "trips.txt": "trip_id,service_id\nt1,s1\n",
  "stop_times.txt":
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n"
    + "t1,10:00:00,10:00:00,A,1,0,0\n"
    + "t1,10:30:00,10:30:00,B,2,0,0\n",
  "feed_info.txt": "feed_start_date,feed_end_date,feed_version\n20250101,20251231,1\n"
};

function feedZip(): Uint8Array<ArrayBuffer> {
  const contents: Record<string, Uint8Array> = {};

  for (const [name, text] of Object.entries(FEED)) {
    contents[name] = strToU8(text);
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
