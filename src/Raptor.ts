import {Journey, Leg, Stop, StopTime, Time, Transfer, Trip, TripID, AnyLeg} from "./GTFS";
import {keyValue, pushNested} from "ts-array-utils";

export class Raptor {
  private readonly routeStopIndex: RouteStopIndex = {};
  private readonly routePath: RoutePaths = {};
  private readonly routesAtStop: RoutesIndexedByStop = {};
  private readonly tripsByRoute: TripsIndexedByRoute = {};
  private readonly tripStopTime: TripStopTimeIndex = {};
  private readonly transfers: TransferIndex = {};
  private readonly stops: Stop[] = [];

  constructor(trips: Trip[], transfers: TransferIndex) {
    for (const trip of trips) {
      const path = trip.stopTimes.map(s => s.stop);
      const routeId = path.join(); // add pickup / drop off?

      if (!this.routeStopIndex[routeId]) {
        this.tripsByRoute[routeId] = [];
        this.routeStopIndex[routeId] = {};
        this.routePath[routeId] = path;

        for (let i = path.length - 1; i >= 0; i--) {
          this.routeStopIndex[routeId][path[i]] = i;

          // if (trip.stopTimes[i].pickUp) { needed for stops array
          pushNested(routeId, this.routesAtStop, path[i]);
        }
      }

      this.tripStopTime[trip.tripId] = trip.stopTimes;
      this.tripsByRoute[routeId].push(trip.tripId);
    }

    for (const stop of Object.keys(this.routesAtStop)) {
      this.transfers[stop] = transfers[stop] || [];
      this.stops.push(stop);
    }

    // sort trips?
  }

  public plan(origin: Stop, destination: Stop, date: number): Journey[] {
    const kArrivals: StopArrivalTimeIndex[] = [];
    const kConnections: ConnectionIndex = this.stops.reduce(keyValue(s => [s, {}]), {});

    kArrivals[0] = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    kArrivals[0][origin] = 0;

    for (let k = 1, markedStops = new Set([origin]); markedStops.size > 0; k++) {
      const queue = this.getQueue(markedStops);
      const newMarkedStops = new Set();

      kArrivals[k] = Object.assign({}, kArrivals[k - 1]);

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          const arrivalTime = kArrivals[k - 1][stopP] + transfer.duration;

          if (arrivalTime < kArrivals[k - 1][stopPi]) {
            kArrivals[k][stopPi] = arrivalTime;
            kConnections[stopPi][k] = transfer; // perf, cast k to string?

            newMarkedStops.add(stopPi);
          }
        }
      }

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stopTimes: StopTime[] | undefined = undefined;

        for (let stopPi = this.routeStopIndex[routeId][stopP]; stopPi < this.routePath[routeId].length; stopPi++) {
          const stopPiName = this.routePath[routeId][stopPi];

          if (stopTimes && stopTimes[stopPi].dropOff && stopTimes[stopPi].arrivalTime < kArrivals[k][stopPiName]) {
            kArrivals[k][stopPiName] = stopTimes[stopPi].arrivalTime;
            kConnections[stopPiName][k] = [stopTimes, boardingPoint, stopPi]; // perf, cast k to string?

            newMarkedStops.add(stopPiName);
          }

          if (!stopTimes || kArrivals[k - 1][stopPiName] < stopTimes[stopPi].arrivalTime) {
            stopTimes = this.getEarliestTrip(routeId, stopPi, kArrivals[k - 1][stopPiName]);
            boardingPoint = stopPi;
          }
        }
      }

      markedStops = newMarkedStops;
    }

    return this.getResults(kConnections, destination);
  }

  private getQueue(markedStops: Set<Stop>): RouteQueue {
    let queue = {};

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

  private getEarliestTrip(routeId: RouteID, stopIndex: number, time: Time): StopTime[] | undefined {
    // perf, store index of trip, it will only ever increase - may not true for overtaken trains
    const tripId = this.tripsByRoute[routeId].find(id => this.tripStopTime[id][stopIndex].departureTime >= time);

    return tripId ? this.tripStopTime[tripId] : undefined;
  }

  private getResults(kConnections: ConnectionIndex, destination: Stop): Journey[] {
    const results: any = [];

    for (const k of Object.keys(kConnections[destination])) { // perf, for in?
      results.push({ legs: this.getJourneyLegs(kConnections, k, destination) });
    }

    return results;
  }

  private getJourneyLegs(kConnections: ConnectionIndex, k: string, finalDestination: Stop) {
    const legs: AnyLeg[] = [];

    for (let destination = finalDestination, i = k as any | 0; i > 0; i--) { // perf, | 0 or Number or parseInt
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
type StopArrivalTimeIndex = Record<Stop, Time>;
type ConnectionIndex = Record<Stop, Record<number, [StopTime[], number, number] | Transfer>>;
type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
type RoutePaths = Record<RouteID, Stop[]>;
type RouteQueue = Record<RouteID, Stop>;
type RoutesIndexedByStop = Record<Stop, RouteID[]>;
type TripsIndexedByRoute = Record<RouteID, TripID[]>;
type TripStopTimeIndex = Record<TripID, StopTime[]>;
type TransferIndex = Record<Stop, Transfer[]>;