import type { RouteIdx, RoutesByStop, StopIdx } from "../network/Timetable.js";

const NOT_QUEUED = -1;

/**
 * Routes to scan, each mapped to the position in the route to start scanning from.
 *
 * The start positions are held in an array indexed by route and the routes touched are collected
 * as they are first seen, so iterating the queue does not walk every route in the network. Both
 * arrays are reused across rounds, resetting only the entries the last round used.
 */
export class RouteQueue {
  private readonly positions: Int32Array;
  private readonly queued: Int32Array;
  private size = 0;

  constructor(numRoutes: number) {
    this.positions = new Int32Array(numRoutes).fill(NOT_QUEUED);
    this.queued = new Int32Array(numRoutes);
  }

  public get length(): number {
    return this.size;
  }

  /**
   * Replace the queue with the routes that pass through the given marked stops
   */
  public build(routesByStop: RoutesByStop, markedStops: StopIdx[]): void {
    const { offsets, route: routes, position: positions } = routesByStop;

    for (let i = 0; i < this.size; i++) {
      this.positions[this.queued[i]] = NOT_QUEUED;
    }

    let size = 0;

    for (const stop of markedStops) {
      const end = offsets[stop + 1];

      for (let i = offsets[stop]; i < end; i++) {
        const route = routes[i];
        const position = positions[i];

        if (this.positions[route] === NOT_QUEUED) {
          this.positions[route] = position;
          this.queued[size++] = route;
        }
        else if (position < this.positions[route]) {
          this.positions[route] = position;
        }
      }
    }

    this.size = size;
  }

  public routeAt(i: number): RouteIdx {
    return this.queued[i];
  }

  public startPositionOf(route: RouteIdx): number {
    return this.positions[route];
  }
}
