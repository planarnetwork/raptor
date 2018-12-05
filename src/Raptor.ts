import {Journey, Stop, StopTime, Transfer, Trip, DayOfWeek, Calendar, Time, ServiceID, DateNumber} from "./GTFS";
import {keyValue, indexBy} from "ts-array-utils";
import {QueueFactory} from "./QueueFactory";
import {ConnectionIndex, ResultsFactory} from "./ResultsFactory";
import {CalendarsByServiceID, RouteID, RouteScanner, RouteScannerFactory, TripsIndexedByRoute} from "./RouteScanner";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class Raptor {

  constructor(
    private readonly routeStopIndex: RouteStopIndex,
    private readonly routePath: RoutePaths,
    private readonly departureTimesAtStop: Record<Stop, Time[]>,
    private readonly transfers: TransfersByOrigin,
    private readonly interchange: Interchange,
    private readonly stops: Stop[],
    private readonly queueFactory: QueueFactory,
    private readonly resultsFactory: ResultsFactory,
    private readonly routeScannerFactory: RouteScannerFactory
  ) { }

  /**
   * Plan a journey between the given stops on the given date and time.
   */
  public plan(origin: Stop, destination: Stop, dateObj: Date, departureTime: Time): Journey[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const kConnections = this.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }

  /**
   * Perform a range query on the given date
   */
  public range(origin: Stop, destination: Stop, dateObj: Date): Journey[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();

    return this.departureTimesAtStop[origin].reduce((results, time) => {
      const kConnections = this.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, time);
      const journeys = this.resultsFactory.getResults(kConnections, destination);

      return results.concat(journeys);
    }, [] as Journey[]).reverse();
  }

  /**
   * Perform a scan of the routes at a given time and return the resulting kConnections index
   */
  private scan(
    routeScanner: RouteScanner,
    bestArrivals: Arrivals,
    origin: Stop,
    date: number,
    dow: DayOfWeek,
    time: Time
  ): ConnectionIndex {

    const kArrivals = [Object.assign({}, bestArrivals, { [origin]: time })];
    const kConnections = this.stops.reduce(keyValue(s => [s, {}]), {});

    for (let k = 1, markedStops = [origin]; markedStops.length > 0; k++) {
      const queue = this.queueFactory.getQueue(markedStops);
      kArrivals[k] = {};

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;
        let trip: Trip | undefined = undefined;

        for (let pi = this.routeStopIndex[routeId][stopP]; pi < this.routePath[routeId].length; pi++) {
          const stopPi = this.routePath[routeId][pi];
          const interchange = this.interchange[stopPi];
          const previousPiArrival = kArrivals[k - 1][stopPi];

          if (stops && stops[pi].dropOff && stops[pi].arrivalTime + interchange < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = stops[pi].arrivalTime + interchange;
            kConnections[stopPi][k] = [trip, boardingPoint, pi];
          }
          else if (previousPiArrival && (!stops || previousPiArrival < stops[pi].arrivalTime + interchange)) {
            trip = routeScanner.getTrip(routeId, date, dow, pi, previousPiArrival);
            stops = trip && trip.stopTimes;
            boardingPoint = pi;
          }
        }
      }

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          const arrival = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = arrival;
            kConnections[stopPi][k] = transfer;
          }
        }
      }

      markedStops = Object.keys(kArrivals[k]);
    }

    return kConnections;
  }

}

/**
 * Create the Raptor algorithm from the GTFS data.
 */
export class RaptorFactory {
  private static readonly DEFAULT_INTERCHANGE_TIME = 0;
  private static readonly OVERTAKING_ROUTE_SUFFIX = "overtakes";

  /**
   * Set up indexes that are required by the Raptor algorithm. If a date is provided all trips will be pre-filtered
   * before being given to the Raptor class.
   */
  public static create(
    trips: Trip[],
    transfers: TransfersByOrigin,
    interchange: Interchange,
    calendars: Calendar[],
    date?: Date
  ): Raptor {

    const departureTimeIndex: Record<string, Record<string, number>> = {};
    const routesAtStop = {};
    const tripsByRoute = {};
    const routeStopIndex = {};
    const routePath = {};
    const usefulTransfers = {};
    const calendarsIndex = calendars.reduce(indexBy(c => c.serviceId), {});

    if (date) {
      const dateNumber = getDateNumber(date);
      const dow = date.getDay() as DayOfWeek;

      trips = trips.filter(trip => this.isRunning(calendarsIndex, trip.serviceId, dateNumber, dow));
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
          interchange[path[i]] = interchange[path[i]] || RaptorFactory.DEFAULT_INTERCHANGE_TIME;
          routesAtStop[path[i]] = routesAtStop[path[i]] || [];
          departureTimeIndex[path[i]] = departureTimeIndex[path[i]] || {};

          if (trip.stopTimes[i].pickUp) {
            routesAtStop[path[i]].push(routeId);
          }
        }
      }

      for (const stopTime of trip.stopTimes.filter(st => st.pickUp)) {
        departureTimeIndex[stopTime.stop][stopTime.departureTime] = stopTime.departureTime;
      }

      tripsByRoute[routeId].push(trip);
    }

    const departureTimesAtStop = {};

    for (const stop in departureTimeIndex) {
      departureTimesAtStop[stop] = Object.values(departureTimeIndex[stop]).sort((a, b) => b - a);
    }

    return new Raptor(
      routeStopIndex,
      routePath,
      departureTimesAtStop,
      usefulTransfers,
      interchange,
      Object.keys(usefulTransfers),
      new QueueFactory(routesAtStop, routeStopIndex),
      new ResultsFactory(),
      new RouteScannerFactory(
        tripsByRoute,
        date ? false : calendarsIndex
      ),
    );
  }

  private static getRouteId(trip: Trip, tripsByRoute: TripsIndexedByRoute) {
    const routeId = trip.stopTimes.map(s => s.stop + (s.pickUp ? 1 : 0) + (s.dropOff ? 1 : 0)).join();

    for (const t of tripsByRoute[routeId] || []) {
      const arrivalTimeA = trip.stopTimes[trip.stopTimes.length - 1].arrivalTime;
      const arrivalTimeB = t.stopTimes[t.stopTimes.length - 1].arrivalTime;

      if (arrivalTimeA < arrivalTimeB) {
        return routeId + RaptorFactory.OVERTAKING_ROUTE_SUFFIX;
      }
    }

    return routeId;
  }

  private static isRunning(
    calendars: CalendarsByServiceID,
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

function getDateNumber(date: Date): number {
  const str = date.toISOString();

  return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
}

export type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
export type RoutePaths = Record<RouteID, Stop[]>;
export type Interchange = Record<Stop, Time>;
export type TransfersByOrigin = Record<Stop, Transfer[]>;
export type Arrivals = Record<Stop, Time>;
