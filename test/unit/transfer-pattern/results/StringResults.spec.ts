import * as chai from "chai";
import {StringResults} from "../../../../src/transfer-pattern/results/StringResults";
import {StopID} from "../../../../src/gtfs/GTFS";

describe("StringResults", () => {

  it("Omits direct connections", () => {
    const tree = new StringResults();

    const expected = {
      "AC": new Set(["B"])
    };

    mergePath(["A", "B", "C"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Merges duplicate paths", () => {
    const tree = new StringResults();

    const expected = {
      "AC": new Set(["B"]),
      "AD": new Set(["B,C"])
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "B", "C"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Orders results", () => {
    const tree = new StringResults();

    const expected = {
      "AC": new Set(["B"]),
      "BC": new Set(["D"]),
      "CE": new Set(["B"]),
    };

    mergePath(["C", "B", "A"], tree);
    mergePath(["C", "D", "B"], tree);
    mergePath(["C", "B", "E"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Adds different paths", () => {
    const tree = new StringResults();
    const expected = {
      "AC": new Set(["B"]),
      "AB": new Set(["C"]),
      "AD": new Set(["B,C", "C,B"])
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "C", "B", "D"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

});

function mergePath(path: StopID[], tree: StringResults): void {
  const kConnections = {};

  for (let i = 1; i < path.length; i++) {
    const origin = path[i - 1];
    const destination = path[i];

    kConnections[destination] = {};
    kConnections[destination][i] = [{ stopTimes: [{ stop: origin }] }, 0, 1];
  }

  tree.add(kConnections);
}
