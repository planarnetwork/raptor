import { describe, it, expect } from "vitest";
import { createTripCalendar, dayOffset, getCalendarWindow, NOT_COVERED } from "../../../src/network/TripCalendar.js";
import { Service } from "../../../src/gtfs/Service.js";
import { addDays, getDateNumber } from "../../../src/query/DateUtil.js";
import { allDays, st, t } from "../util.js";
import type { Trip } from "../../../src/gtfs/GTFS.js";

describe("TripCalendar", () => {

  function tripOn(service: Service): Trip {
    return { ...t(st("A", null, 1000), st("B", 1100, null)), service };
  }

  function runsOn(trips: Trip[], from: number, to: number, date: number, trip = 0): boolean {
    const calendar = createTripCalendar(trips, from, to);
    const offset = dayOffset(calendar, date);

    return offset !== NOT_COVERED && (calendar.runs[offset + (trip >> 3)] & (1 << (trip & 7))) !== 0;
  }

  const everyDay = new Service(20180101, 20181231, allDays, {});
  const weekdays = new Service(20180101, 20181231, { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false }, {});

  it("sets a bit for every day a trip runs", () => {
    expect(runsOn([tripOn(everyDay)], 20180101, 20180107, 20180103)).toBe(true);
  });

  it("obeys the day of week", () => {
    // the 6th of January 2018 was a Saturday
    expect(runsOn([tripOn(weekdays)], 20180101, 20180107, 20180105)).toBe(true);
    expect(runsOn([tripOn(weekdays)], 20180101, 20180107, 20180106)).toBe(false);
  });

  it("obeys the service date range", () => {
    const service = new Service(20180103, 20180104, allDays, {});

    expect(runsOn([tripOn(service)], 20180101, 20180107, 20180102)).toBe(false);
    expect(runsOn([tripOn(service)], 20180101, 20180107, 20180103)).toBe(true);
    expect(runsOn([tripOn(service)], 20180101, 20180107, 20180105)).toBe(false);
  });

  it("obeys the calendar exceptions", () => {
    const excluded = new Service(20180101, 20181231, allDays, { 20180103: false });
    const included = new Service(20180101, 20180101, allDays, { 20180103: true });

    expect(runsOn([tripOn(excluded)], 20180101, 20180107, 20180103)).toBe(false);
    expect(runsOn([tripOn(included)], 20180101, 20180107, 20180103)).toBe(true);
  });

  it("keeps each trip's bit separate", () => {
    const trips = [tripOn(weekdays), tripOn(everyDay)];

    // the 6th of January 2018 was a Saturday, so only the second trip runs
    expect(runsOn(trips, 20180101, 20180107, 20180106, 0)).toBe(false);
    expect(runsOn(trips, 20180101, 20180107, 20180106, 1)).toBe(true);
  });

  it("keeps trips beyond the first byte separate", () => {
    const trips = [...Array(20)].map((_, i) => tripOn(i === 17 ? everyDay : weekdays));

    expect(runsOn(trips, 20180101, 20180107, 20180106, 16)).toBe(false);
    expect(runsOn(trips, 20180101, 20180107, 20180106, 17)).toBe(true);
  });

  it("does not cover a date outside its period", () => {
    const calendar = createTripCalendar([tripOn(everyDay)], 20180101, 20180107);

    expect(dayOffset(calendar, 20171231)).toBe(NOT_COVERED);
    expect(dayOffset(calendar, 20180108)).toBe(NOT_COVERED);
    expect(dayOffset(calendar, 20180101)).toBe(0);
    expect(dayOffset(calendar, 20180107)).toBe(6 * calendar.stride);
  });

  it("takes the period from the feed where it gives one", () => {
    expect(getCalendarWindow(20260814, 20261114)).toEqual([20260814, 20261114]);
  });

  it("anchors on the end date when that is all the feed gives", () => {
    expect(getCalendarWindow(undefined, 20261114)).toEqual([addDays(20261114, -120), 20261114]);
  });

  it("rejects a feed that ends before it starts", () => {
    expect(() => getCalendarWindow(20261114, 20260814))
      .toThrow(/cannot end before it starts, feed_info covers 20261114 to 20260814/);
  });

  it("covers 120 days from today when the feed does not say", () => {
    const today = getDateNumber(new Date());

    expect(getCalendarWindow(undefined, undefined)).toEqual([today, addDays(today, 120)]);
  });

});
