import type { RouteIdx, RoutesByStop, StopIdx } from "../network/Timetable.js";

/**
 * Routes to scan, each mapped to the position in the route to start scanning from.
 */
export type RouteQueue = Map<RouteIdx, number>;

/**
 * Take the marked stops and return the routes that pass through them, each paired with the
 * earliest position in the route that needs to be scanned.
 */
export function buildQueue(routesByStop: RoutesByStop, markedStops: StopIdx[]): RouteQueue {
  const { offsets, route: routes, position: positions } = routesByStop;
  const queue: RouteQueue = new Map();

  for (const stop of markedStops) {
    const end = offsets[stop + 1];

    for (let i = offsets[stop]; i < end; i++) {
      const route = routes[i];
      const position = positions[i];
      const queued = queue.get(route);

      if (queued === undefined || position < queued) {
        queue.set(route, position);
      }
    }
  }

  return queue;
}
