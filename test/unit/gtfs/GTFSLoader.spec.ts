import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { GTFSFetchError, loadGTFS, loadGTFSFromUrl } from "../../../src/gtfs/GTFSLoader.js";
import type { LoadProgress } from "../../../src/gtfs/Progress.js";

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
  "transfers.txt": "from_stop_id,to_stop_id,min_transfer_time\nA,A,300\n",
  "feed_info.txt": "feed_start_date,feed_end_date,feed_version\n20250101,20251231,1\n",
  // present in a real feed, and of no interest to the loader
  "routes.txt": "route_id,route_short_name\nr1,X\n",
  "agency.txt": "agency_id,agency_name\na1,Anytown Buses\n"
};

function feedZip(files: Record<string, string> = FEED): Uint8Array<ArrayBuffer> {
  const contents: Record<string, Uint8Array> = {};

  for (const [name, text] of Object.entries(files)) {
    contents[name] = strToU8(text);
  }

  return zipSync(contents);
}

describe("loadGTFS", () => {

  it("loads a feed from bytes", async () => {
    const feed = await loadGTFS(feedZip());

    expect(1).toBe(feed.trips.length);
    expect("t1").toBe(feed.trips[0].tripId);
    expect(2).toBe(feed.trips[0].stopTimes.length);
    expect(2).toBe(Object.keys(feed.stops).length);
    expect(300).toBe(feed.interchange.A);
    expect(20250101).toBe(feed.feedInfo?.startDate);
  });

  it("loads a feed from a Blob", async () => {
    const feed = await loadGTFS(new Blob([feedZip()]));

    expect(1).toBe(feed.trips.length);
  });

  it("loads a feed that nests its files in a directory", async () => {
    const nested: Record<string, string> = {};

    for (const [name, text] of Object.entries(FEED)) {
      nested[`gtfs/${name}`] = text;
    }

    expect(1).toBe((await loadGTFS(feedZip(nested))).trips.length);
  });

  it("gives the trip a working calendar", async () => {
    const feed = await loadGTFS(feedZip());

    expect(true).toBe(feed.trips[0].service.runsOn(20250601, 1));
    expect(false).toBe(feed.trips[0].service.runsOn(20240601, 1));
  });

  it("reports progress and finishes with the building phase", async () => {
    const reports: LoadProgress[] = [];

    await loadGTFS(feedZip(), { onProgress: p => reports.push({ ...p }), progressInterval: 0 });

    expect(true).toBe(reports.length > 0);
    expect("building").toBe(reports[reports.length - 1].phase);
    expect(true).toBe(reports[reports.length - 1].rows > 0);
  });

  it("knows the size of the zip when the source knows it", async () => {
    const zip = feedZip();
    const reports: LoadProgress[] = [];

    await loadGTFS(zip, { onProgress: p => reports.push({ ...p }), progressInterval: 0 });

    expect(zip.length).toBe(reports[reports.length - 1].bytesTotal);
  });

  /**
   * Reading a zip forwards means anything that is not one simply yields no entries, without
   * complaint, so a url that returns an error page with a 200 would otherwise load as an empty
   * feed and only go wrong later when nothing could be planned.
   */
  it("refuses a source that is not a GTFS zip", async () => {
    const page = new TextEncoder().encode("<html><body>404 Not Found</body></html>");

    await expect(loadGTFS(page)).rejects.toThrow(/No GTFS files found/);
  });

  it("refuses a zip with no GTFS files in it", async () => {
    await expect(loadGTFS(feedZip({ "readme.txt": "nothing to see" }))).rejects.toThrow(/No GTFS files found/);
  });

  it("does not report progress when nobody asked for it", async () => {
    // no assertion beyond it not throwing: the row counter is skipped entirely in this case
    expect(1).toBe((await loadGTFS(feedZip(), {})).trips.length);
  });

  it("reports the file it is reading and how big it is", async () => {
    const reports: LoadProgress[] = [];

    await loadGTFS(feedZip(), { onProgress: p => reports.push({ ...p }), progressInterval: 0 });

    const stopTimes = reports.find(r => r.entry === "stop_times.txt");

    expect(true).toBe(stopTimes !== undefined);
    expect(FEED["stop_times.txt"].length).toBe(stopTimes?.entryBytesTotal);
  });

  /**
   * The first report always goes out, so a caller showing a progress bar has something to show
   * straight away rather than after the first interval has passed.
   */
  it("throttles progress to the interval it was given", async () => {
    const reports: LoadProgress[] = [];

    // an interval nothing can beat, so only the first report and the last one get through
    await loadGTFS(feedZip(), { onProgress: p => reports.push({ ...p }), progressInterval: 60000 });

    expect(2).toBe(reports.length);
    expect("reading").toBe(reports[0].phase);
    expect("building").toBe(reports[1].phase);
  });

});

describe("loadGTFSFromUrl", () => {

  it("loads a feed the server returns", async () => {
    const feed = await loadGTFSFromUrl("https://example.com/gtfs.zip", {
      fetch: async () => new Response(feedZip())
    });

    expect(1).toBe(feed.trips.length);
  });

  it("passes the headers and signal on to the fetch", async () => {
    let seen: RequestInit | undefined;

    await loadGTFSFromUrl("https://example.com/gtfs.zip", {
      headers: { "x-api-key": "secret" },
      fetch: async (_url, init) => { seen = init; return new Response(feedZip()); }
    });

    expect("secret").toBe((seen?.headers as Record<string, string>)["x-api-key"]);
  });

  it("reports the status when the server refuses", async () => {
    const failing = loadGTFSFromUrl("https://example.com/gtfs.zip", {
      fetch: async () => new Response("nope", { status: 404 })
    });

    await expect(failing).rejects.toThrow(/responded 404/);
  });

  /**
   * A browser gives no detail at all when it blocks a cross origin request, so the error has to
   * say what the cause almost certainly was rather than passing on a bare "Failed to fetch".
   */
  it("explains that a failed fetch is probably CORS", async () => {
    const failing = loadGTFSFromUrl("https://example.com/gtfs.zip", {
      fetch: async () => { throw new TypeError("Failed to fetch"); }
    });

    await expect(failing).rejects.toThrow(/Access-Control-Allow-Origin/);
    await expect(failing).rejects.toBeInstanceOf(GTFSFetchError);
  });

  it("keeps the underlying error as the cause", async () => {
    const cause = new TypeError("Failed to fetch");

    try {
      await loadGTFSFromUrl("https://example.com/gtfs.zip", { fetch: async () => { throw cause; } });
      expect.unreachable();
    }
    catch (e) {
      expect(cause).toBe((e as GTFSFetchError).cause);
      expect("https://example.com/gtfs.zip").toBe((e as GTFSFetchError).url);
    }
  });

  /**
   * An abort is the caller's own doing, so dressing it up as a fetch failure would be misleading.
   */
  it("reports an abort as itself rather than as a fetch failure", async () => {
    const controller = new AbortController();

    controller.abort();

    const failing = loadGTFSFromUrl("https://example.com/gtfs.zip", {
      signal: controller.signal,
      fetch: async (_url, init) => {
        init?.signal?.throwIfAborted();

        return new Response(feedZip());
      }
    });

    await expect(failing).rejects.not.toBeInstanceOf(GTFSFetchError);
  });

  it("accepts a URL as well as a string", async () => {
    const feed = await loadGTFSFromUrl(new URL("https://example.com/gtfs.zip"), {
      fetch: async () => new Response(feedZip())
    });

    expect(1).toBe(feed.trips.length);
  });

});
