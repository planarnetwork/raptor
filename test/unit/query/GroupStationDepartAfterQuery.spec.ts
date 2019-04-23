import * as chai from "chai";
import { calendars, j, setDefaultTrip, st, t } from "../util";
import { RaptorAlgorithmFactory } from "../../../src/raptor/RaptorAlgorithmFactory";
import { JourneyFactory } from "../../../src/results/JourneyFactory";
import { MultipleCriteriaFilter } from "../../../src/results/filter/MultipleCriteriaFilter";
import { GroupStationDepartAfterQuery } from "../../../src/query/GroupStationDepartAfterQuery";

describe("GroupStationDepartAfterQuery", () => {
  const journeyFactory = new JourneyFactory();
  const filters = [new MultipleCriteriaFilter()];

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

    const raptor = RaptorAlgorithmFactory.create(trips, {}, {}, calendars);
    const query = new GroupStationDepartAfterQuery(raptor, journeyFactory, 1, filters);
    const result = query.plan(["A"], ["C", "D"], new Date("2019-04-18"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
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

    const raptor = RaptorAlgorithmFactory.create(trips, {}, {}, calendars);
    const query = new GroupStationDepartAfterQuery(raptor, journeyFactory, 1, filters);
    const result = query.plan(["A", "B"], ["C", "D"], new Date("2019-04-18"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
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
