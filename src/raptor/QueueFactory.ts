import {StopID} from "../gtfs/GTFS";
import {RouteID} from "./RouteScanner";
import {RouteStopIndex} from "./RaptorAlgorithm";

/**
 * Create a queue for the Raptor algorithm to use on each iteration of the algorithm.
 */
export class QueueFactory {

  constructor(
    private readonly routesAtStop: RoutesIndexedByStop,
    private readonly routeStopIndex: RouteStopIndex
  ) {}

  /**
   * Take the marked stops and return an index of any routes that pass through those stops.
   */
  public getQueue(markedStops: StopID[]): RouteQueue {
    const queue: RouteQueue = [];

    for (const stop of markedStops) {
      for (const routeId of this.routesAtStop[stop]) {
        queue.push([routeId, stop]);
      }
    }

    return queue;
  }

  private isStopBefore(routeId: RouteID, stopA: StopID, stopB: StopID): boolean {
    return this.routeStopIndex[routeId][stopA] < this.routeStopIndex[routeId][stopB];
  }
}

type RouteQueue = [RouteID, StopID][];
type RoutesIndexedByStop = Record<StopID, RouteID[]>;
