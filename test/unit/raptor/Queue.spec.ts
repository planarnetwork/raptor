import { describe, it, expect } from "vitest";
import { buildQueue } from "../../../src/raptor/Queue";
import type { Timetable } from "../../../src/raptor/Timetable";

const StopA = 0;
const StopB = 1;
const RouteA = 0;
const RouteB = 1;
const RouteC = 2;

/**
 * Build the part of the timetable the queue factory reads: for each stop, the routes picking up
 * there and the position of that stop within each of those routes.
 */
function timetable(...stops: [route: number, position: number][][]): Timetable {
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
    stopRouteOffsets: Int32Array.from(offsets),
    stopRoutes: Int32Array.from(routes),
    stopRoutePos: Int32Array.from(positions)
  } as unknown as Timetable;
}

describe("buildQueue", () => {

  it("enqueues stops", () => {
    const actual = buildQueue(timetable(
      [[RouteA, 1], [RouteB, 2]],
      [[RouteB, 1], [RouteC, 1]]
    ), [StopA, StopB]);
    const expected = new Map([[RouteA, 1], [RouteB, 1], [RouteC, 1]]);

    expect(actual).toEqual(expected);
  });

  it("picks the earliest stop on the route", () => {
    const actual = buildQueue(timetable(
      [[RouteA, 1], [RouteB, 1]],
      [[RouteB, 2], [RouteC, 1]]
    ), [StopB, StopA]);
    const expected = new Map([[RouteB, 1], [RouteC, 1], [RouteA, 1]]);

    expect(actual).toEqual(expected);
  });

});
