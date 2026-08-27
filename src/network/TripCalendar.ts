import type { DateNumber, Trip } from "../gtfs/GTFS";
import type { Service } from "../gtfs/Service";
import { addDays, daysBetween, getDateNumber, getDayOfWeek } from "../query/DateUtil";

/**
 * How long a feed is assumed to cover when it does not say
 */
const DEFAULT_DAYS = 120;

/**
 * Which trips run on which date, as a bit per trip per day.
 *
 * The scan checks this for every trip it considers, so the calendar is resolved up front rather
 * than evaluated during a query: the day of week, the date range and the exceptions are all folded
 * into the bit while the timetable is being built.
 *
 * Days are stored one after another, so the trips of a route sit next to each other within a day
 * and the check is a single byte read.
 */
export function createTripCalendar(trips: Trip[], startDate: DateNumber, endDate: DateNumber): TripCalendar {
  const days = daysBetween(startDate, endDate) + 1;
  const stride = (trips.length + 7) >> 3;
  const runs = new Uint8Array(days * stride);

  // there are far fewer services than trips, so each one is only evaluated once per day
  const services: Service[] = [];
  const serviceIndex = new Map<Service, number>();
  const tripService = new Int32Array(trips.length);

  for (let trip = 0; trip < trips.length; trip++) {
    const service = trips[trip].service;
    let index = serviceIndex.get(service);

    if (index === undefined) {
      index = services.length;
      serviceIndex.set(service, index);
      services.push(service);
    }

    tripService[trip] = index;
  }

  const runsToday = new Uint8Array(services.length);

  for (let day = 0; day < days; day++) {
    const date = addDays(startDate, day);
    const dow = getDayOfWeek(date);

    for (let service = 0; service < services.length; service++) {
      runsToday[service] = services[service].runsOn(date, dow) ? 1 : 0;
    }

    const base = day * stride;

    for (let trip = 0; trip < trips.length; trip++) {
      if (runsToday[tripService[trip]] === 1) {
        runs[base + (trip >> 3)] |= 1 << (trip & 7);
      }
    }
  }

  return { startDate, endDate, stride, runs };
}

/**
 * The period a feed covers, taken from feed_info where it gives one
 */
export function getCalendarWindow(startDate?: DateNumber, endDate?: DateNumber): [DateNumber, DateNumber] {
  const start = startDate ?? getDateNumber(new Date());

  return [start, endDate ?? addDays(start, DEFAULT_DAYS)];
}

/**
 * Byte offset of a date's slice of runs, or NOT_COVERED if the calendar does not reach it
 */
export function dayOffset(calendar: TripCalendar, date: DateNumber): number {
  const day = daysBetween(calendar.startDate, date);

  return day < 0 || date > calendar.endDate ? NOT_COVERED : day * calendar.stride;
}

/**
 * Returned by dayOffset for a date outside the period the calendar covers
 */
export const NOT_COVERED = -1;

export interface TripCalendar {
  /** First date the calendar covers */
  startDate: DateNumber;
  /** Last date the calendar covers */
  endDate: DateNumber;
  /** Bytes per day, which is one bit per trip rounded up */
  stride: number;
  /** Day major bit per trip: runs[day * stride + (trip >> 3)] & (1 << (trip & 7)) */
  runs: Uint8Array;
}
