import { describe, it, expect } from "vitest";
import { buildQueue } from "../../../src/raptor/Queue.js";
import type { RoutesByStop } from "../../../src/network/Timetable.js";

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

describe("buildQueue", () => {

  it("enqueues stops", () => {
    const actual = buildQueue(routesByStop(
      [[RouteA, 1], [RouteB, 2]],
      [[RouteB, 1], [RouteC, 1]]
    ), [StopA, StopB]);
    const expected = new Map([[RouteA, 1], [RouteB, 1], [RouteC, 1]]);

    expect(actual).toEqual(expected);
  });

  it("picks the earliest stop on the route", () => {
    const actual = buildQueue(routesByStop(
      [[RouteA, 1], [RouteB, 1]],
      [[RouteB, 2], [RouteC, 1]]
    ), [StopB, StopA]);
    const expected = new Map([[RouteB, 1], [RouteC, 1], [RouteA, 1]]);

    expect(actual).toEqual(expected);
  });

});
