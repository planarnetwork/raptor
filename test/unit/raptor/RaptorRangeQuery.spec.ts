import {calendars, j, setDefaultTrip, st, t} from "../util";
import {RaptorQueryFactory} from "../../../src/raptor/RaptorAlgorithm";
import * as chai from "chai";
import {JourneyFactory} from "../../../src/results/JourneyFactory";

describe("RaptorRangeQuery", () => {
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

    const raptor = RaptorQueryFactory.createRangeQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

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

});