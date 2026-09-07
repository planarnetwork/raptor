import { describe, it, expect } from "vitest";
import { RouteQueue } from "../../../src/raptor/Queue.js";
import type { RouteIdx, RoutesByStop } from "../../../src/network/Timetable.js";

const StopA = 0;
const StopB = 1;
const RouteA = 0;
const RouteB = 1;
const RouteC = 2;

/**
 * For each stop, the routes picking up there and the position of that stop within each of them.
 */
function routesByStop(...stops: [route: number, position: number][][]): RoutesByStop {
  const offsets: number[] = [];
  const routes: number[] = [];
  const positions: number[] = [];

  for (const stop of stops) {
    offsets.push(routes.length);

    for (const [route, position] of stop) {
      routes.push(route);
      positions.push(position);
    }
  }

  offsets.push(routes.length);

  return {
    offsets: Int32Array.from(offsets),
    route: Int32Array.from(routes),
    position: Int32Array.from(positions)
  };
}

function contentsOf(queue: RouteQueue): [RouteIdx, number][] {
  return Array.from({ length: queue.length }, (_, i) => {
    const route = queue.routeAt(i);

    return [route, queue.startPositionOf(route)];
  });
}

describe("RouteQueue", () => {

  it("enqueues stops", () => {
    const queue = new RouteQueue(3);

    queue.build(routesByStop(
      [[RouteA, 1], [RouteB, 2]],
      [[RouteB, 1], [RouteC, 1]]
    ), [StopA, StopB]);

    expect(contentsOf(queue)).toEqual([[RouteA, 1], [RouteB, 1], [RouteC, 1]]);
  });

  it("picks the earliest stop on the route", () => {
    const queue = new RouteQueue(3);

    queue.build(routesByStop(
      [[RouteA, 1], [RouteB, 1]],
      [[RouteB, 2], [RouteC, 1]]
    ), [StopB, StopA]);

    expect(contentsOf(queue)).toEqual([[RouteB, 1], [RouteC, 1], [RouteA, 1]]);
  });

  it("replaces the previous round's contents when it is rebuilt", () => {
    const queue = new RouteQueue(3);
    const routes = routesByStop(
      [[RouteA, 1], [RouteB, 2]],
      [[RouteB, 1], [RouteC, 1]]
    );

    queue.build(routes, [StopA, StopB]);
    queue.build(routes, [StopB]);

    expect(contentsOf(queue)).toEqual([[RouteB, 1], [RouteC, 1]]);
  });

});
