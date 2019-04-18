
/**
 * Convert a Date object into a numeric representation e.g. 20190417
 */
export function getDateNumber(date: Date): number {
  const str = date.toISOString();

  return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
}
