import { calendars, j, setDefaultTrip, st, t } from "../util";
import * as chai from "chai";
import { JourneyFactory } from "../../../src/results/JourneyFactory";
import { RaptorAlgorithmFactory } from "../../../src/raptor/RaptorAlgorithmFactory";
import { RangeQuery } from "../../../src/query/RangeQuery";

describe("RangeQuery", () => {
  const journeyFactory = new JourneyFactory();

  it("performs profile queries", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("A", null, 1100),
        st("B", 1130, 1135),
        st("C", 1200, null)
      ),
      t(
        st("A", null, 1200),
        st("B", 1230, 1235),
        st("C", 1300, null)
      )
    ];

    const raptor = RaptorAlgorithmFactory.create(trips, {}, {}, calendars);
    const query = new RangeQuery(raptor, journeyFactory);
    const result = query.plan("A", "C", new Date("2018-10-16"));

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ]),
      j([
        st("A", null, 1100),
        st("B", 1130, 1135),
        st("C", 1200, null)
      ]),
      j([
        st("A", null, 1200),
        st("B", 1230, 1235),
        st("C", 1300, null)
      ])
    ]);
  });

  /**
   * Unfortunately it is not possible to share the bestArrivals index or the state of the route scanner between
   * departure times in a range query.
   *
   * Consider a journey:
   *
   * A -> B -> C, departing at 1400, arriving at 1500
   *
   * There may be an earlier journey with no changes
   *
   * A -> C, departing at 1359 that arrives at 1501
   *
   * That is rejected because it does not improve the earliest arrival time at C
   */
  it("does not share bestArrivals or routeScanner", () => {
    const trips = [
      t(
        st("A", null, 1359),
        st("C", 1501, null)
      ),
      t(
        st("A", null, 1400),
        st("B", 1430, null)
      ),
      t(
        st("B", null, 1430),
        st("C", 1500, null)
      )
    ];

    const raptor = RaptorAlgorithmFactory.create(trips, {}, {}, calendars);
    const query = new RangeQuery(raptor, journeyFactory);
    const result = query.plan("A", "C", new Date("2018-10-16"));

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1359),
        st("C", 1501, null)
      ]),
      j([
        st("A", null, 1400),
        st("B", 1430, null)
      ],
      [
        st("B", null, 1430),
        st("C", 1500, null)
      ]),
      j([
        st("A", null, 1400),
        st("B", 1430, null)
      ],
      [
        st("B", null, 1430),
        st("C", 1500, null)
      ]),
    ]);
  });

});
