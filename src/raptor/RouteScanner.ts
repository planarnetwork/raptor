import { DateNumber, DayOfWeek, Time, Trip } from "../gtfs/GTFS";

/**
 * Returns trips for specific routes. Maintains a reference to the last trip returned in order to reduce plan time.
 */
export class RouteScanner {

  constructor(
    private readonly tripsByRoute: TripsIndexedByRoute,
    private readonly routeScanPosition: Record<RouteID, number>
  ) {}

  /**
   * Return the earliest trip stop times possible on the given route
   */
  public getTrip(
    routeId: RouteID,
    date: DateNumber,
    dow: DayOfWeek,
    stopIndex: number,
    time: Time
  ): Trip | undefined {

    if (!this.routeScanPosition.hasOwnProperty(routeId)) {
      this.routeScanPosition[routeId] = this.tripsByRoute[routeId].length - 1;
    }

    let lastFound;

    // iterate backwards through the trips on the route, starting where we last found a trip
    for (let i = this.routeScanPosition[routeId]; i >= 0; i--) {
      const trip = this.tripsByRoute[routeId][i];

      // if the trip is unreachable, exit the loop
      if (trip.stopTimes[stopIndex].departureTime < time) {
        break;
      }
      // if it is reachable and the service is running that day, update the last valid trip found
      else if (trip.service.runsOn(date, dow)) {
        lastFound = trip;
      }

      // if we found a trip, update the last found index, if we still haven't found a trip we can also update the
      // last found index as any subsequent scans will be for an earlier time. We can't update the index every time
      // as there may be some services that are reachable but not running before the last found service and searching
      // must continue from the last reachable point.
      if (!lastFound || lastFound === trip) {
        this.routeScanPosition[routeId] = i;
      }
    }

    return lastFound;
  }

}

/**
 * Create the RouteScanner from GTFS trips and calendars
 */
export class RouteScannerFactory {

  constructor(
    private readonly tripsByRoute: TripsIndexedByRoute
  ) {}

  public create(): RouteScanner {
    return new RouteScanner(this.tripsByRoute, {});
  }

}

export type RouteID = string;
export type TripsIndexedByRoute = Record<RouteID, Trip[]>;
