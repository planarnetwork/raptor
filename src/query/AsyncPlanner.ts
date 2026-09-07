import type { StopID, Time } from "@gb-transit/gtfs-loader";
import type { Journey } from "../results/Journey.js";

/**
 * Something that answers the same question as GroupStationDepartAfterQuery, but off this thread.
 *
 * A scan is synchronous and JavaScript has one thread, so a query can only be made parallel by
 * putting the scans somewhere else. This is the seam: give a query several of these and it will
 * keep them all busy. A PlannerClient satisfies it, as does anything wrapping a worker of your
 * own. Passing a GroupStationDepartAfterQuery wrapped in a resolved promise also satisfies it and
 * runs everything on this thread, which is useful for testing but is not parallel.
 */
export interface AsyncPlanner {
  plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<Journey[]>;
}
