import { CalendarIndex, DateNumber, DayOfWeek, ServiceID, Trip } from "../gtfs/GTFS";
import { Interchange, RaptorAlgorithm, TransfersByOrigin } from "./RaptorAlgorithm";
import { QueueFactory } from "./QueueFactory";
import { RouteScannerFactory, TripsIndexedByRoute } from "./RouteScanner";
import { getDateNumber } from "../query/DateUtil";

/**
 * Prepares GTFS data for the raptor algorithm
 */
export class RaptorAlgorithmFactory {
  private static readonly DEFAULT_INTERCHANGE_TIME = 0;
  private static readonly OVERTAKING_ROUTE_SUFFIX = "overtakes";

  /**
   * Set up indexes that are required by the Raptor algorithm. If a date is provided all trips will be pre-filtered
   * before being given to the Raptor class.
   *
   * If a date is passed all trips will be filtered to ensure they run on that date. This improves query performance
   * but reduces flexibility
   */
  public static create(
    trips: Trip[],
    transfers: TransfersByOrigin,
    interchange: Interchange,
    calendars: CalendarIndex,
    date?: Date
  ): RaptorAlgorithm {

    const routesAtStop = {};
    const tripsByRoute = {};
    const routeStopIndex = {};
    const routePath = {};
    const usefulTransfers = {};

    if (date) {
      const dateNumber = getDateNumber(date);
      const dow = date.getDay() as DayOfWeek;

      trips = trips.filter(trip => this.isRunning(calendars, trip.serviceId, dateNumber, dow));
    }

    trips.sort((a, b) => a.stopTimes[0].departureTime - b.stopTimes[0].departureTime);

    for (const trip of trips) {
      const path = trip.stopTimes.map(s => s.stop);
      const routeId = this.getRouteId(trip, tripsByRoute);

      if (!routeStopIndex[routeId]) {
        tripsByRoute[routeId] = [];
        routeStopIndex[routeId] = {};
        routePath[routeId] = path;

        for (let i = path.length - 1; i >= 0; i--) {
          routeStopIndex[routeId][path[i]] = i;
          usefulTransfers[path[i]] = transfers[path[i]] || [];
          interchange[path[i]] = interchange[path[i]] || RaptorAlgorithmFactory.DEFAULT_INTERCHANGE_TIME;
          routesAtStop[path[i]] = routesAtStop[path[i]] || [];

          if (trip.stopTimes[i].pickUp) {
            routesAtStop[path[i]].push(routeId);
          }
        }
      }

      tripsByRoute[routeId].push(trip);
    }

    return new RaptorAlgorithm(
      routeStopIndex,
      routePath,
      usefulTransfers,
      interchange,
      Object.keys(usefulTransfers),
      new QueueFactory(routesAtStop, routeStopIndex),
      new RouteScannerFactory(tripsByRoute, date ? false : calendars),
    );
  }

  private static getRouteId(trip: Trip, tripsByRoute: TripsIndexedByRoute) {
    const routeId = trip.stopTimes.map(s => s.stop + (s.pickUp ? 1 : 0) + (s.dropOff ? 1 : 0)).join();

    for (const t of tripsByRoute[routeId] || []) {
      const arrivalTimeA = trip.stopTimes[trip.stopTimes.length - 1].arrivalTime;
      const arrivalTimeB = t.stopTimes[t.stopTimes.length - 1].arrivalTime;

      if (arrivalTimeA < arrivalTimeB) {
        return routeId + RaptorAlgorithmFactory.OVERTAKING_ROUTE_SUFFIX;
      }
    }

    return routeId;
  }

  private static isRunning(
    calendars: CalendarIndex,
    serviceId: ServiceID,
    date: DateNumber,
    dow: DayOfWeek
  ): boolean {

    return !calendars[serviceId].exclude[date] && (calendars[serviceId].include[date] || (
      calendars[serviceId].startDate <= date &&
      calendars[serviceId].endDate >= date &&
      calendars[serviceId].days[dow]
    ));
  }
}
