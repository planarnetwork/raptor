import type { Time } from "../gtfs/GTFS";
import { DROP_OFF, PICK_UP, type RouteIdx, type Routes, type StopIdx } from "../network/Timetable";

/**
 * A view positioned on one route, holding the offsets its slices start at so that the scan works
 * in positions and trip numbers local to the route rather than indexes into the global arrays.
 *
 * It is a view, not a copy: every accessor reads through to the timetable. Resolving the offsets
 * costs three loads, so it is done once per route in `moveTo` rather than once per stop, which is
 * also why a cursor is reused across routes instead of being allocated for each one.
 */
export class RouteCursor {
  private atRoute = -1;
  private stopsBase = 0;
  private timesBase = 0;
  private firstTrip = 0;
  private stopsInRoute = 0;

  constructor(private readonly routes: Routes) { }

  /**
   * The route the cursor is positioned on
   */
  public get route(): RouteIdx {
    return this.atRoute;
  }

  /**
   * Number of stops on the route, which is also the stride of its arrivals and departures
   */
  public get numStops(): number {
    return this.stopsInRoute;
  }

  /**
   * Position the cursor on a route, resolving where its slice of each global array starts.
   */
  public moveTo(route: RouteIdx): void {
    const { stopOffsets, stopTimesBase, tripOffsets } = this.routes;

    this.atRoute = route;
    this.stopsBase = stopOffsets[route];
    this.stopsInRoute = stopOffsets[route + 1] - this.stopsBase;
    this.timesBase = stopTimesBase[route];
    this.firstTrip = tripOffsets[route];
  }

  public stopAt(position: number): StopIdx {
    return this.routes.stops[this.stopsBase + position];
  }

  /**
   * Whether the route takes passengers on at the given position
   */
  public canPickUp(position: number): boolean {
    return (this.routes.flags[this.stopsBase + position] & PICK_UP) !== 0;
  }

  /**
   * Whether the route sets passengers down at the given position
   */
  public canDropOff(position: number): boolean {
    return (this.routes.flags[this.stopsBase + position] & DROP_OFF) !== 0;
  }

  public arrival(trip: number, position: number): Time {
    return this.routes.arrivals[this.timesBase + trip * this.stopsInRoute + position];
  }

  public departure(trip: number, position: number): Time {
    return this.routes.departures[this.timesBase + trip * this.stopsInRoute + position];
  }

  /**
   * The route's nth trip in the global, route major numbering the calendar is bit packed in
   */
  public globalTrip(trip: number): number {
    return this.firstTrip + trip;
  }
}
