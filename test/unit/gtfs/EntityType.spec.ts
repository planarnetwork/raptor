import { describe, it, expect } from "vitest";
import { COLUMNS, entityTypeOf } from "../../../src/gtfs/EntityType.js";

describe("entityTypeOf", () => {

  it("names the entity each file holds", () => {
    expect("calendar").toBe(entityTypeOf("calendar.txt"));
    expect("calendar_date").toBe(entityTypeOf("calendar_dates.txt"));
    expect("trip").toBe(entityTypeOf("trips.txt"));
    expect("stop_time").toBe(entityTypeOf("stop_times.txt"));
    expect("transfer").toBe(entityTypeOf("transfers.txt"));
    expect("feed_info").toBe(entityTypeOf("feed_info.txt"));
    expect("stop").toBe(entityTypeOf("stops.txt"));
  });

  it("reads a feed that nests its files in a directory", () => {
    expect("stop_time").toBe(entityTypeOf("gtfs/stop_times.txt"));
    expect("stop").toBe(entityTypeOf("some/deep/path/stops.txt"));
  });

  it("ignores the files the loader does not read", () => {
    expect(undefined).toBe(entityTypeOf("links.txt"));
    expect(undefined).toBe(entityTypeOf("routes.txt"));
    expect(undefined).toBe(entityTypeOf("agency.txt"));
    expect(undefined).toBe(entityTypeOf("shapes.txt"));
  });

  it("ignores directory entries", () => {
    expect(undefined).toBe(entityTypeOf("gtfs/"));
  });

  it("ignores the metadata a zip made on a mac carries", () => {
    expect(undefined).toBe(entityTypeOf("__MACOSX/._stops.txt"));
  });

  it("does not mistake a file whose name merely ends in one it reads", () => {
    expect(undefined).toBe(entityTypeOf("old_stops.txt"));
  });

});

describe("COLUMNS", () => {

  it("takes only the stop time columns the loader reads", () => {
    // the order of the calls comes from the order of the rows, so stop_sequence is not needed
    expect(false).toBe(COLUMNS.stop_time.includes("stop_sequence"));
    expect(false).toBe(COLUMNS.stop_time.includes("timepoint"));
    expect(6).toBe(COLUMNS.stop_time.length);
  });

});
