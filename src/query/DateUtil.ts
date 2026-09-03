import type { DateNumber, DayOfWeek } from "../gtfs/GTFS.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Convert a Date object into a numeric representation e.g. 20190417
 */
export function getDateNumber(date: Date): DateNumber {
  const str = date.toISOString();

  return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
}

/**
 * Number of days from one date to another, negative if the second is the earlier
 */
export function daysBetween(from: DateNumber, to: DateNumber): number {
  return Math.round((toTimestamp(to) - toTimestamp(from)) / MILLISECONDS_PER_DAY);
}

/**
 * The date the given number of days after the given one
 */
export function addDays(date: DateNumber, days: number): DateNumber {
  return getDateNumber(new Date(toTimestamp(date) + days * MILLISECONDS_PER_DAY));
}

/**
 * Sunday = 0, Monday = 1... as JavaScript numbers them
 */
export function getDayOfWeek(date: DateNumber): DayOfWeek {
  return new Date(toTimestamp(date)).getUTCDay() as DayOfWeek;
}

// UTC throughout so that a clock change never moves a date onto the day either side of it
function toTimestamp(date: DateNumber): number {
  return Date.UTC(Math.floor(date / 10000), Math.floor(date / 100) % 100 - 1, date % 100);
}
