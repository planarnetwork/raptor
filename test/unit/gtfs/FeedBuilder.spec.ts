import { describe, it, expect } from "vitest";
import { FeedBuilder } from "../../../src/gtfs/FeedBuilder.js";
import { normalise } from "../../../src/gtfs/Normalise.js";

describe("FeedBuilder", () => {

  it("gives a trip its stop times in the order the file listed them", () => {
    const builder = new FeedBuilder();

    builder.add("trip", { trip_id: "t1", service_id: "s1" });
    builder.add("stop_time", { trip_id: "t1", stop_id: "A", arrival_time: "10:00:00", departure_time: "10:00:00" });
    builder.add("stop_time", { trip_id: "t1", stop_id: "B", arrival_time: "10:30:00", departure_time: "10:30:00" });

    const [trip] = builder.build().trips;

    expect(2).toBe(trip.stopTimes.length);
    expect("A").toBe(trip.stopTimes[0].stop);
    expect("B").toBe(trip.stopTimes[1].stop);
    expect(36000).toBe(trip.stopTimes[0].arrivalTime);
  });

  it("gives a trip with no stop times an empty list", () => {
    const builder = new FeedBuilder();

    builder.add("trip", { trip_id: "t1", service_id: "s1" });

    expect(0).toBe(builder.build().trips[0].stopTimes.length);
  });

  it("takes the stop times of a trip that appears before its stop times", () => {
    const builder = new FeedBuilder();

    builder.add("stop_time", { trip_id: "t1", stop_id: "A", arrival_time: "10:00:00", departure_time: "10:00:00" });
    builder.add("trip", { trip_id: "t1", service_id: "s1" });

    expect(1).toBe(builder.build().trips[0].stopTimes.length);
  });

  /**
   * A feed leaves pickup_type empty for an ordinary call, and the parser reports an empty field as
   * undefined. Reading that as "not allowed" would silently drop most of the calls in a feed.
   */
  it("treats a stop time with no pick up or set down code as usable", () => {
    const builder = new FeedBuilder();

    builder.add("trip", { trip_id: "t1", service_id: "s1" });
    builder.add("stop_time", { trip_id: "t1", stop_id: "A", arrival_time: "10:00:00", departure_time: "10:00:00" });

    const [stopTime] = builder.build().trips[0].stopTimes;

    expect(true).toBe(stopTime.pickUp);
    expect(true).toBe(stopTime.dropOff);
  });

  it("obeys an explicit pick up or set down code", () => {
    const builder = new FeedBuilder();

    builder.add("trip", { trip_id: "t1", service_id: "s1" });
    builder.add("stop_time", {
      trip_id: "t1", stop_id: "A", arrival_time: "10:00:00", departure_time: "10:00:00",
      pickup_type: "1", drop_off_type: "0"
    });

    const [stopTime] = builder.build().trips[0].stopTimes;

    expect(false).toBe(stopTime.pickUp);
    expect(true).toBe(stopTime.dropOff);
  });

  it("records a footpath from a stop to itself as interchange time", () => {
    const builder = new FeedBuilder();

    builder.add("transfer", { from_stop_id: "A", to_stop_id: "A", min_transfer_time: "300" });

    const feed = builder.build();

    expect(300).toBe(feed.interchange.A);
    expect(undefined).toBe(feed.transfers.A);
  });

  it("records a footpath between two stops as a transfer", () => {
    const builder = new FeedBuilder();

    builder.add("transfer", { from_stop_id: "A", to_stop_id: "B", min_transfer_time: "300" });

    const feed = builder.build();

    expect(1).toBe(feed.transfers.A.length);
    expect("B").toBe(feed.transfers.A[0].destination);
    expect(undefined).toBe(feed.interchange.A);
  });

  it("gives a transfer with no window one that is always open", () => {
    const builder = new FeedBuilder();

    builder.add("transfer", { from_stop_id: "A", to_stop_id: "B", min_transfer_time: "300" });

    const [transfer] = builder.build().transfers.A;

    expect(0).toBe(transfer.startTime);
    expect(Number.MAX_SAFE_INTEGER).toBe(transfer.endTime);
  });

  it("keeps the window of a transfer that has one", () => {
    const builder = new FeedBuilder();

    builder.add("transfer", {
      from_stop_id: "A", to_stop_id: "B", min_transfer_time: "300",
      start_time: "06:00:00", end_time: "22:00:00"
    });

    const [transfer] = builder.build().transfers.A;

    expect(21600).toBe(transfer.startTime);
    expect(79200).toBe(transfer.endTime);
  });

  it("maps the days of a calendar onto the days of the week", () => {
    const builder = new FeedBuilder();

    builder.add("calendar", {
      service_id: "s1", start_date: "20250101", end_date: "20251231",
      monday: "1", tuesday: "0", wednesday: "0", thursday: "0",
      friday: "0", saturday: "0", sunday: "1"
    });
    builder.add("trip", { trip_id: "t1", service_id: "s1" });

    const { service } = builder.build().trips[0];

    expect(true).toBe(service.runsOn(20250105, 0)); // a Sunday
    expect(true).toBe(service.runsOn(20250106, 1)); // a Monday
    expect(false).toBe(service.runsOn(20250107, 2)); // a Tuesday
  });

  it("applies the exceptions in calendar_dates.txt", () => {
    const builder = new FeedBuilder();

    builder.add("calendar", {
      service_id: "s1", start_date: "20250101", end_date: "20251231",
      monday: "1", tuesday: "1", wednesday: "1", thursday: "1",
      friday: "1", saturday: "1", sunday: "1"
    });
    builder.add("calendar_date", { service_id: "s1", date: "20250106", exception_type: "2" });
    builder.add("calendar_date", { service_id: "s1", date: "20260106", exception_type: "1" });
    builder.add("trip", { trip_id: "t1", service_id: "s1" });

    const { service } = builder.build().trips[0];

    expect(false).toBe(service.runsOn(20250106, 1)); // excluded
    expect(true).toBe(service.runsOn(20250107, 2)); // ordinary
    expect(true).toBe(service.runsOn(20260106, 1)); // included, though outside the window
  });

  it("reads the period the feed covers", () => {
    const builder = new FeedBuilder();

    builder.add("feed_info", { feed_start_date: "20250901", feed_end_date: "20251101", feed_version: "7" });

    const { feedInfo } = builder.build();

    expect(20250901).toBe(feedInfo?.startDate);
    expect(20251101).toBe(feedInfo?.endDate);
    expect("7").toBe(feedInfo?.version);
  });

  it("reads a stop", () => {
    const builder = new FeedBuilder();

    builder.add("stop", {
      stop_id: "9100NRCH", stop_code: "NRW", stop_name: "Norwich", stop_desc: "",
      stop_lat: "52.627", stop_lon: "1.306", location_type: "1", platform_code: "4"
    });

    const stop = builder.build().stops["9100NRCH"];

    expect("NRW").toBe(stop.code);
    expect("Norwich").toBe(stop.name);
    expect(52.627).toBe(stop.latitude);
    expect(1).toBe(stop.locationType);
    expect("4").toBe(stop.platformCode);
  });

  it("defaults the location type of a stop that does not give one", () => {
    const builder = new FeedBuilder();

    builder.add("stop", { stop_id: "A", stop_lat: "1", stop_lon: "2" });

    expect(0).toBe(builder.build().stops.A.locationType);
  });

  /**
   * A feed that leaves stop_code empty names the station by its stop_id. If an empty field were
   * read as "" rather than undefined every such station would claim the same code and the
   * timetable would refuse to build, so this is worth pinning down.
   */
  it("names a station by its stop_id when the feed gives no stop_code", () => {
    const builder = new FeedBuilder();

    builder.add("stop", { stop_id: "A", stop_lat: "1", stop_lon: "2" });
    builder.add("stop", { stop_id: "B", stop_lat: "3", stop_lon: "4" });

    const { stations } = normalise(builder.build());

    expect("A").toBe(stations.get("A"));
    expect("B").toBe(stations.get("B"));
  });

});
