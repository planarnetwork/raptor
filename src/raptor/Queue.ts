import type { RouteIdx, StopIdx, Timetable } from "./Timetable";

/**
 * Routes to scan, each mapped to the position in the route to start scanning from.
 */
export type RouteQueue = Map<RouteIdx, number>;

/**
 * Take the marked stops and return the routes that pass through them, each paired with the
 * earliest position in the route that needs to be scanned.
 */
export function buildQueue(timetable: Timetable, markedStops: StopIdx[]): RouteQueue {
  const { stopRoutes, stopRoutePos, stopRouteOffsets } = timetable;
  const queue: RouteQueue = new Map();

  for (const stop of markedStops) {
    const end = stopRouteOffsets[stop + 1];

    for (let i = stopRouteOffsets[stop]; i < end; i++) {
      const route = stopRoutes[i];
      const position = stopRoutePos[i];
      const queued = queue.get(route);

      if (queued === undefined || position < queued) {
        queue.set(route, position);
      }
    }
  }

  return queue;
}
