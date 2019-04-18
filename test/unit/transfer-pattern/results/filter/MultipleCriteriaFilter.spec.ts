import * as chai from "chai";
import { MultipleCriteriaFilter } from "../../../../../src/results/filter/MultipleCriteriaFilter";
import { j, st } from "../../../util";

describe("MultipleCriteriaFilter", () => {
  const filter = new MultipleCriteriaFilter();

  it("removes slower journeys", () => {
    const journeys = [
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ]),
      j([
        st("A", null, 900),
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
    ];

    const expected = [
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
    ];
    const actual = filter.apply(journeys);

    chai.expect(actual).to.deep.equal(expected);
  });

  it("keeps slower journeys if they have fewer changes", () => {
    const journeys = [
      j(
        [st("A", null, 1000), st("B", 1030, 1035)],
        [st("C", 1100, null)]
      ),
      j([
        st("A", null, 900),
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
    ];

    const expected = [
      j([
        st("A", null, 900),
        st("C", 1100, null)
      ]),
      j(
        [st("A", null, 1000), st("B", 1030, 1035)],
        [st("C", 1100, null)]
      ),
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
    ];
    const actual = filter.apply(journeys);

    chai.expect(actual).to.deep.equal(expected);
  });

  it("sorts journeys before filtering them", () => {
    const journeys = [
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ]),
      j([
        st("A", null, 900),
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
      ]),
      j([
        st("A", null, 1200),
        st("B", 1230, 1235),
        st("C", 1330, null)
      ])
    ];

    const expected = [
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
    ];
    const actual = filter.apply(journeys);

    chai.expect(actual).to.deep.equal(expected);
  });

});
