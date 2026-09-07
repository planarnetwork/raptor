import { describe, it, expect } from "vitest";
import { createNetwork } from "../../../src/network/Network.js";
import { GroupStationDepartAfterQuery } from "../../../src/query/GroupStationDepartAfterQuery.js";
import { ParallelRangeQuery } from "../../../src/query/ParallelRangeQuery.js";
import { RangeQuery } from "../../../src/query/RangeQuery.js";
import { JourneyFactory } from "../../../src/results/JourneyFactory.js";
import { MultipleCriteriaFilter } from "../../../src/results/filter/MultipleCriteriaFilter.js";
import type { AsyncPlanner } from "../../../src/query/AsyncPlanner.js";
import type { Network } from "../../../src/network/Network.js";
import { feed, st, t, tf } from "../util.js";

/**
 * A pool that runs everything on this thread. It exercises the batching without needing workers,
 * which is what a real pool would use.
 */
function pool(network: Network, size: number): AsyncPlanner[] {
  return Array.from({ length: size }, () => {
    const query = new GroupStationDepartAfterQuery(network, new JourneyFactory());

    return { plan: async (o, d, date, time) => query.plan(o, d, date, time) };
  });
}

function departureTimes(journeys: { departureTime: number }[]): number[] {
  return [...new Set(journeys.map(j => j.departureTime))].sort((a, b) => a - b);
}

describe("ParallelRangeQuery", () => {
  const date = new Date("2018-10-16");

  const trips = [
    t(st("A", null, 1000), st("B", 1030, 1035), st("C", 1100, null)),
    t(st("A", null, 1200), st("B", 1230, 1235), st("C", 1300, null)),
    t(st("A", null, 1400), st("B", 1430, 1435), st("C", 1500, null)),
    t(st("A", null, 1600), st("B", 1630, 1635), st("C", 1700, null))
  ];

  it("finds the same departures as the sequential range query", async () => {
    const network = createNetwork(feed(trips));
    const sequential = new RangeQuery(network, new JourneyFactory(), 1, [new MultipleCriteriaFilter()]);
    const parallel = new ParallelRangeQuery(network, pool(network, 3), [new MultipleCriteriaFilter()]);

    const expected = sequential.plan("A", "C", new Date(date), 1, 2400);
    const actual = await parallel.plan("A", "C", new Date(date), 1, 2400);

    expect(departureTimes(actual)).toEqual(departureTimes(expected));
    expect(departureTimes(actual)).toEqual([1000, 1200, 1400, 1600]);
  });

  it("stops once it has enough results", async () => {
    const network = createNetwork(feed(trips));
    const parallel = new ParallelRangeQuery(network, pool(network, 2), [new MultipleCriteriaFilter()]);
    const actual = await parallel.plan("A", "C", new Date(date), 1, 2400, 2);

    // the batch that reached the target is finished rather than abandoned, so a whole batch of
    // departures is returned and never more than one batch beyond the target
    expect(actual.length).toBeGreaterThanOrEqual(2);
    expect(actual.length).toBeLessThan(4);
  });

  it("counts a departure reached on foot from the origin", async () => {
    const network = createNetwork(feed(
      [t(st("B", null, 1000), st("C", 1100, null))],
      { A: [tf("A", "B", 60)] },
      {},
      {}
    ));
    const parallel = new ParallelRangeQuery(network, pool(network, 2));
    const actual = await parallel.plan("A", "C", new Date(date), 1, 2400);

    expect(actual.length).toBe(1);
    expect(actual[0].arrivalTime).toBe(1100);
  });

  it("returns nothing for an origin the feed has no stop for", async () => {
    const network = createNetwork(feed(trips));
    const parallel = new ParallelRangeQuery(network, pool(network, 2));

    expect(await parallel.plan("XXX", "C", new Date(date), 1, 2400)).toEqual([]);
  });

  it("needs at least one planner", () => {
    const network = createNetwork(feed(trips));

    expect(() => new ParallelRangeQuery(network, [])).toThrow();
  });

});
