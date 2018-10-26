import {
  Journey,
  Stop,
  StopTime,
  Time,
  Transfer,
  Trip,
  TripID,
  AnyLeg,
  DateNumber,
  DayOfWeek,
  Calendar,
  ServiceID
} from "./GTFS";
import {keyValue, indexBy} from "ts-array-utils";

export class Raptor {
  private static readonly DEFAULT_INTERCHANGE_TIME = 0;
  private readonly routeStopIndex: RouteStopIndex = {};
  private readonly routePath: RoutePaths = {};
  private readonly routesAtStop: RoutesIndexedByStop = {};
  private readonly tripsByRoute: TripsIndexedByRoute = {};
  private readonly transfers: TransfersByOrigin = {};
  private readonly interchange: Interchange = {};
  private readonly stops: Stop[] = [];
  private readonly calendars: CalendarsByServiceID;

  constructor(trips: Trip[], transfers: TransfersByOrigin, interchange: Interchange, calendars: Calendar[]) {
    // perf, sort trips after they've been indexed by route?
    trips.sort((a, b) => a.stopTimes[0].departureTime - b.stopTimes[0].departureTime);

    for (const trip of trips) {
      const path = trip.stopTimes.map(s => s.stop);
      let routeId = trip.stopTimes.map(s => s.stop + (s.pickUp ? 1 : 0) + (s.dropOff ? 1 : 0)).join();

      for (const t of this.tripsByRoute[routeId] || []) {
        const arrivalTimeA = trip.stopTimes[trip.stopTimes.length - 1].arrivalTime;
        const arrivalTimeB = t.stopTimes[t.stopTimes.length - 1].arrivalTime;

        if (arrivalTimeA < arrivalTimeB) {
          routeId += "overtakes";
          break;
        }
      }

      if (!this.routeStopIndex[routeId]) {
        this.tripsByRoute[routeId] = [];
        this.routeStopIndex[routeId] = {};
        this.routePath[routeId] = path;

        for (let i = path.length - 1; i >= 0; i--) {
          this.routeStopIndex[routeId][path[i]] = i;
          this.transfers[path[i]] = transfers[path[i]] || [];
          this.routesAtStop[path[i]] = this.routesAtStop[path[i]] || [];
          this.interchange[path[i]] = interchange[path[i]] || Raptor.DEFAULT_INTERCHANGE_TIME;

          if (trip.stopTimes[i].pickUp) {
            this.routesAtStop[path[i]].push(routeId);
          }
        }
      }

      this.tripsByRoute[routeId].push(trip);
    }

    this.stops = Object.keys(this.transfers);
    this.calendars = calendars.reduce(indexBy(c => c.serviceId), {});
  }

  public plan(origin: Stop, destination: Stop, dateObj: Date): Journey[] {
    const date = this.getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const kArrivals = [this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {})];
    const kConnections = this.stops.reduce(keyValue(s => [s, {}]), {});

    kArrivals[0][origin] = 0;

    for (let k = 1, markedStops = new Set([origin]); markedStops.size > 0; k++) {
      const queue = this.getQueue(markedStops);
      const newMarkedStops = new Set();

      kArrivals[k] = Object.assign({}, kArrivals[k - 1]);

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;

        for (let stopPi = this.routeStopIndex[routeId][stopP]; stopPi < this.routePath[routeId].length; stopPi++) {
          const stopPiName = this.routePath[routeId][stopPi];
          const interchange = this.interchange[stopPiName];

          if (stops && stops[stopPi].dropOff && stops[stopPi].arrivalTime + interchange < kArrivals[k][stopPiName]) {
            kArrivals[k][stopPiName] = stops[stopPi].arrivalTime + interchange;
            kConnections[stopPiName][k] = [stops, boardingPoint, stopPi];

            newMarkedStops.add(stopPiName);
          }
          else if (!stops || kArrivals[k - 1][stopPiName] < stops[stopPi].arrivalTime + interchange) {
            stops = this.getEarliestTrip(routeId, date, dayOfWeek, stopPi, kArrivals[k - 1][stopPiName]);
            boardingPoint = stopPi;
          }
        }
      }

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          const arrivalTime = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (arrivalTime < kArrivals[k][stopPi]) {
            kArrivals[k][stopPi] = arrivalTime;
            kConnections[stopPi][k] = transfer;

            newMarkedStops.add(stopPi);
          }
        }
      }

      markedStops = newMarkedStops;
    }

    return this.getResults(kConnections, destination);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
  }

  private getQueue(markedStops: Set<Stop>): RouteQueue {
    const queue = {};

    for (const stop of markedStops) {
      for (const routeId of this.routesAtStop[stop]) {
        queue[routeId] = queue[routeId] && this.isStopBefore(routeId, queue[routeId], stop) ? queue[routeId] : stop;
      }
    }

    return queue;
  }

  private isStopBefore(routeId: RouteID, stopA: Stop, stopB: Stop): boolean {
    return this.routeStopIndex[routeId][stopA] < this.routeStopIndex[routeId][stopB];
  }

  private getEarliestTrip(
    routeId: RouteID,
    date: DateNumber,
    dow: DayOfWeek,
    stopIndex: number,
    time: Time
  ): StopTime[] | undefined {

    const tId = this.tripsByRoute[routeId].findIndex(t => {
      return (t.stopTimes[stopIndex].departureTime >= time && this.serviceIsRunning(t.serviceId, date, dow));
    });

    return tId !== -1 ? this.tripsByRoute[routeId][tId].stopTimes : undefined;
  }

  private serviceIsRunning(serviceId: ServiceID, date: DateNumber, dow: DayOfWeek): boolean {
    return !this.calendars[serviceId].exclude[date] && (this.calendars[serviceId].include[date] || (
      this.calendars[serviceId].startDate <= date &&
      this.calendars[serviceId].endDate >= date &&
      this.calendars[serviceId].days[dow]
    ));
  }

  private getResults(kConnections: ConnectionIndex, destination: Stop): Journey[] {
    const results: Journey[] = [];

    for (const k of Object.keys(kConnections[destination])) {
      results.push({ legs: this.getJourneyLegs(kConnections, k, destination) });
    }

    return results;
  }

  private getJourneyLegs(kConnections: ConnectionIndex, k: string, finalDestination: Stop) {
    const legs: AnyLeg[] = [];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {
        legs.push(connection);

        destination = connection.origin;
      }
      else {
        const [tripStopTimes, start, end] = connection;
        const stopTimes = tripStopTimes.slice(start, end + 1);
        const origin = stopTimes[0].stop;

        legs.push({ stopTimes, origin, destination });

        destination = origin;
      }
    }

    return legs.reverse();
  }
}

function isTransfer(connection: [StopTime[], number, number] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}

type RouteID = string;
type ConnectionIndex = Record<Stop, Record<number, [StopTime[], number, number] | Transfer>>;
type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
type RoutePaths = Record<RouteID, Stop[]>;
type RouteQueue = Record<RouteID, Stop>;
type RoutesIndexedByStop = Record<Stop, RouteID[]>;
type TripsIndexedByRoute = Record<RouteID, Trip[]>;
type CalendarsByServiceID = Record<ServiceID, Calendar>;

export type Interchange = Record<Stop, number>;
export type TransfersByOrigin = Record<Stop, Transfer[]>;
