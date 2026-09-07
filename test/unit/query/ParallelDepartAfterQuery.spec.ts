import { describe, it, expect } from "vitest";
import { createNetwork } from "../../../src/network/Network.js";
import { DepartAfterQuery } from "../../../src/query/DepartAfterQuery.js";
import { GroupStationDepartAfterQuery } from "../../../src/query/GroupStationDepartAfterQuery.js";
import { ParallelDepartAfterQuery } from "../../../src/query/ParallelDepartAfterQuery.js";
import { JourneyFactory } from "../../../src/results/JourneyFactory.js";
import type { AsyncPlanner } from "../../../src/query/AsyncPlanner.js";
import { feed, st, t } from "../util.js";

describe("ParallelDepartAfterQuery", () => {
  const date = new Date("2018-10-16");
  const trips = [
    t(st("A", null, 1000), st("B", 1030, 1035), st("C", 1100, null)),
    t(st("A", null, 1200), st("B", 1230, 1235), st("C", 1300, null))
  ];

  it("returns what the query it dispatches to returns", async () => {
    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, new JourneyFactory());
    const parallel = new ParallelDepartAfterQuery([
      { plan: async (o, d, at, time) => query.plan(o, d, at, time) }
    ]);

    const expected = new DepartAfterQuery(network, new JourneyFactory()).plan("A", "C", new Date(date), 900);
    const actual = await parallel.plan("A", "C", new Date(date), 900);

    expect(actual).toEqual(expected);
  });

  it("sends concurrent queries to different planners", async () => {
    const started: number[] = [];
    let release = () => { };
    const held = new Promise<void>(resolve => { release = resolve; });

    const planners: AsyncPlanner[] = [0, 1, 2].map(id => ({
      plan: async () => {
        started.push(id);
        await held;

        return [];
      }
    }));

    const parallel = new ParallelDepartAfterQuery(planners);
    const queries = [
      parallel.plan("A", "C", date, 900),
      parallel.plan("A", "C", date, 900),
      parallel.plan("A", "C", date, 900)
    ];

    release();
    await Promise.all(queries);

    expect(started).toEqual([0, 1, 2]);
  });

  it("frees a planner again when a query fails", async () => {
    const planners: AsyncPlanner[] = [
      { plan: async () => { throw new Error("no"); } },
      { plan: async () => [] }
    ];
    const parallel = new ParallelDepartAfterQuery(planners);

    await expect(parallel.plan("A", "C", date, 900)).rejects.toThrow("no");
    // the first planner is idle again, so it is chosen again rather than the second
    await expect(parallel.plan("A", "C", date, 900)).rejects.toThrow("no");
  });

  it("needs at least one planner", () => {
    expect(() => new ParallelDepartAfterQuery([])).toThrow();
  });

});
