/**
 * The kinds of row the loader reads. A feed contains more than these; the rest are not opened.
 */
export type EntityType =
  | "calendar"
  | "calendar_date"
  | "trip"
  | "stop_time"
  | "transfer"
  | "feed_info"
  | "stop";

/**
 * The file each entity comes from.
 */
const FILES: Record<string, EntityType> = {
  "calendar.txt": "calendar",
  "calendar_dates.txt": "calendar_date",
  "trips.txt": "trip",
  "stop_times.txt": "stop_time",
  "transfers.txt": "transfer",
  "feed_info.txt": "feed_info",
  "stops.txt": "stop"
};

/**
 * The columns each entity is read from, so the parser can leave the rest in the chunk.
 *
 * stop_times.txt carries stop_sequence, stop_headsign, shape_dist_traveled and timepoint too. The
 * order of the calls is taken from the order of the rows, not from stop_sequence, and nothing reads
 * the other three, so on the largest file in a feed four columns in ten are never sliced out.
 */
export const COLUMNS: Record<EntityType, readonly string[]> = {
  calendar: [
    "service_id", "start_date", "end_date",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
  ],
  calendar_date: ["service_id", "date", "exception_type"],
  trip: ["trip_id", "service_id"],
  stop_time: ["trip_id", "arrival_time", "departure_time", "stop_id", "pickup_type", "drop_off_type"],
  transfer: ["from_stop_id", "to_stop_id", "min_transfer_time", "start_time", "end_time"],
  feed_info: ["feed_start_date", "feed_end_date", "feed_version"],
  stop: [
    "stop_id", "stop_code", "stop_name", "stop_desc", "stop_lat", "stop_lon",
    "zone_id", "location_type", "parent_station", "platform_code"
  ]
};

/**
 * The entity a zip entry holds, or undefined for one the loader does not read.
 *
 * Feeds are not consistent about layout, so the entry is matched on its file name alone: a feed
 * that nests everything in a directory is read the same as one that does not.
 */
export function entityTypeOf(name: string): EntityType | undefined {
  if (name.endsWith("/") || name.startsWith("__MACOSX/")) {
    return undefined;
  }

  const start = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1;

  return FILES[name.slice(start).toLowerCase()];
}
