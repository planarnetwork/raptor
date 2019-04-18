import * as chai from "chai";
import {GraphResults} from "../../../../src/transfer-pattern/results/GraphResults";
import {StopID} from "../../../../src/gtfs/GTFS";

describe("GraphResults", () => {

  it("Merges a path into an empty tree", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B", "C"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Merges duplicate paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B", "C"], tree);
    mergePath(["A", "B"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Appends to existing paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["A", "B"], tree);
    mergePath(["A", "B", "C"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

  it("Appends different paths", () => {
    const tree = new GraphResults();
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };
    const D = { label: "D", parent: C };
    const D1 = { label: "D", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C],
      "D": [D, D1]
    };

    mergePath(["A", "B", "C", "D"], tree);
    mergePath(["A", "B", "D"], tree);

    chai.expect(tree.finalize()).to.deep.equal(expected);
  });

});

function mergePath(path: StopID[], tree: GraphResults): void {
  const kConnections = {};

  for (let i = 1; i < path.length; i++) {
    const origin = path[i - 1];
    const destination = path[i];

    kConnections[destination] = {};
    kConnections[destination][i] = [{ stopTimes: [{ stop: origin }] }, 0, 1];
  }

  tree.add(kConnections);
}
