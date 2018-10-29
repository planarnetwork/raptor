import {Stop} from "./GTFS";
import {RouteID} from "./RouteScanner";
import {RouteStopIndex} from "./Raptor";

export class QueueFactory {

  constructor(
    private readonly routesAtStop: RoutesIndexedByStop,
    private readonly routeStopIndex: RouteStopIndex
  ) {}

  public getQueue(markedStops: Stop[]): RouteQueue {
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
}

type RouteQueue = Record<RouteID, Stop>;
type RoutesIndexedByStop = Record<Stop, RouteID[]>;
