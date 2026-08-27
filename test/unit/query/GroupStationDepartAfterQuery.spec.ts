import { describe, it, expect } from "vitest";
import { feed, j, setDefaultTrip, st, t } from "../util";
import { createNetwork } from "../../../src/raptor/Network";
import { JourneyFactory } from "../../../src/results/JourneyFactory";
import { MultipleCriteriaFilter } from "../../../src/results/filter/MultipleCriteriaFilter";
import { GroupStationDepartAfterQuery } from "../../../src/query/GroupStationDepartAfterQuery";

describe("GroupStationDepartAfterQuery", () => {
  const journeyFactory = new JourneyFactory();
  const filters = [new MultipleCriteriaFilter()];

  it("rejects a date the timetable has no calendar for", () => {
    const trips = [t(st("A", null, 1000), st("B", 1030, null))];
    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);

    expect(() => query.plan(["A"], ["B"], new Date("2031-04-18"), 900))
      .toThrow(/covers 20180101 to 20201231, so it cannot plan for 20310418/);
  });

  it("returns no results for a destination the feed has no stop for", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);

    expect(query.plan(["A"], ["Z"], new Date("2019-04-18"), 900)).toEqual([]);
  });

  it("still plans to the destinations the feed does have", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);
    const result = query.plan(["A"], ["Z", "C"], new Date("2019-04-18"), 900);

    setDefaultTrip(result);

    expect(result).toEqual([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ])
    ]);
  });

  it("returns no results for an origin the feed has no stop for", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);

    expect(query.plan(["Z"], ["C"], new Date("2019-04-18"), 900)).toEqual([]);
  });

  it("plans to multiple destinations", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("A", null, 1200),
        st("B", 1230, 1235),
        st("D", 1300, null)
      )
    ];

    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);
    const result = query.plan(["A"], ["C", "D"], new Date("2019-04-18"), 900);

    setDefaultTrip(result);

    expect(result).toEqual([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ]),
      j([
        st("A", null, 1200),
        st("B", 1230, 1235),
        st("D", 1300, null)
      ])
    ]);
  });

  it("plans from multiple origins", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("A", null, 1200),
        st("_", 1230, 1235),
        st("D", 1300, null)
      )
    ];

    const network = createNetwork(feed(trips));
    const query = new GroupStationDepartAfterQuery(network, journeyFactory, 1, filters);
    const result = query.plan(["A", "B"], ["C", "D"], new Date("2019-04-18"), 900);

    setDefaultTrip(result);

    expect(result).toEqual([
      j([
        st("B", 1030, 1035),
        st("C", 1100, null)
      ]),
      j([
        st("A", null, 1200),
        st("_", 1230, 1235),
        st("D", 1300, null)
      ])
    ]);
  });

});
