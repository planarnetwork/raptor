import {Stop, StopTime, Time, Trip, TripID} from "./GTFS";
import {keyValue, pushNested} from "ts-array-utils";

export class Raptor {
  private readonly routeStopIndex: RouteStopIndex = {};
  private readonly routePath: RoutePaths = {};
  private readonly routesAtStop: RoutesIndexedByStop = {};
  private readonly tripsByRoute: TripsIndexedByRoute = {};
  private readonly tripStopTime: TripStopTimeIndex = {};
  private readonly stops: Stop[];

  constructor(private readonly trips: Trip[]) {
    for (const trip of trips) {
      const path = trip.stopTimes.map(s => s.stop);
      const routeId = path.join(); // add pickup / drop off?

      if (!this.routeStopIndex[routeId]) {
        this.routeStopIndex[routeId] = {};
        this.routePath[routeId] = path;

        for (let i = path.length - 1; i >= 0; i--) {
          this.routeStopIndex[routeId][path[i]] = i;

          // if (trip.stopTimes[i].pickUp) { needed for stops array
          pushNested(routeId, this.routesAtStop, path[i]);
        }
      }

      this.tripStopTime[trip.tripId] = {};

      for (const stopTime of trip.stopTimes) { // perf, reverse? At least make consistent with above
        this.tripStopTime[trip.tripId][stopTime.stop] = this.tripStopTime[trip.tripId][stopTime.stop] || stopTime;
      }

      pushNested(trip.tripId, this.tripsByRoute, routeId);
    }

    this.stops = Object.keys(this.routesAtStop);

    // sort trips?
  }

  public plan(origin: Stop, destination: Stop, date: number): Stop[][] {
    const kArrivals: StopArrivalTimeIndex[] = [];
    const kConnections: ConnectionIndex = this.stops.reduce(keyValue(s => [s, {}]), {});

    kArrivals[0] = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    kArrivals[0][origin] = 0;

    for (let k = 1, markedStops = new Set([origin]); markedStops.size > 0; k++) {
      const queue = this.getQueue(markedStops);

      markedStops = new Set();
      kArrivals[k] = Object.assign({}, kArrivals[k - 1]);

      for (const [routeId, stopP] of Object.entries(queue)) {
        let stopTimes: TripStopTimes | undefined = undefined;

        for (let pi = this.routeStopIndex[routeId][stopP]; pi < this.routePath[routeId].length; pi++) {
          const stopPi = this.routePath[routeId][pi];

          if (stopTimes && stopTimes[stopPi].dropOff && stopTimes[stopPi].arrivalTime < kArrivals[k][stopPi]) {
            kArrivals[k][stopPi] = stopTimes[stopPi].arrivalTime;
            kConnections[stopPi][k] = stopP;

            markedStops.add(stopPi);
          }
          // This comes after to avoid getting a new trip for the first stop, we've already got our arrival time there.
          // As we may have arrived at pi sooner than the previous stop we might have an earlier trip on this route
          if (!stopTimes || kArrivals[k - 1][stopPi] < stopTimes[stopPi].arrivalTime) {
            stopTimes = this.getEarliestTrip(routeId, stopPi, kArrivals[k - 1][stopPi]);
          }
        }
      }
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

  private getEarliestTrip(routeId: RouteID, stop: Stop, time: Time): TripStopTimes | undefined {
    // perf, store index of trip, it will only ever increase - may not true for overtaken trains
    const tripId = this.tripsByRoute[routeId].find(id => this.tripStopTime[id][stop].departureTime >= time);

    return tripId ? this.tripStopTime[tripId] : undefined;
  }

  private getResults(kConnections: ConnectionIndex, destination: Stop): Stop[][] {
    const results: any = [];

    // perf for in?
    for (const k of Object.keys(kConnections[destination])) {
      let d = destination;
      let i = k as any | 0; // perf, is just an any better

      const legs: any = [d];

      while (i > 0) {
        const o = kConnections[d][i];

        legs.push(o);
        d = o;
        i--;
      }

      results.push(legs.reverse());
    }

    return results;
  }

}

type RouteID = string;
type StopArrivalTimeIndex = Record<Stop, Time>;
type ConnectionIndex = Record<Stop, Record<number, Stop>>;
type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
type RoutePaths = Record<RouteID, Stop[]>;
type RouteQueue = Record<RouteID, Stop>;
type RoutesIndexedByStop = Record<Stop, RouteID[]>;
type TripsIndexedByRoute = Record<RouteID, TripID[]>;
type TripStopTimeIndex = Record<TripID, TripStopTimes>;
type TripStopTimes = Record<Stop, StopTime>;
