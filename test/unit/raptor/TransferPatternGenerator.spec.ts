import * as chai from "chai";
import {mergePath} from "../../../src/raptor/TransferPatternGenerator";

describe("TransferPatternMerge", () => {

  it("Merges a path into an empty tree", () => {
    const tree = {};
    const path = ["C", "B", "A"];
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(path, tree);

    chai.expect(tree).to.deep.equal(expected);
  });

  it("Merges duplicate paths", () => {
    const tree = {};
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["C", "B", "A"], tree);
    mergePath(["B", "A"], tree);

    chai.expect(tree).to.deep.equal(expected);
  });

  it("Appends to existing paths", () => {
    const tree = {};
    const A = { label: "A", parent: null };
    const B = { label: "B", parent: A };
    const C = { label: "C", parent: B };

    const expected = {
      "A": [A],
      "B": [B],
      "C": [C]
    };

    mergePath(["B", "A"], tree);
    mergePath(["C", "B", "A"], tree);

    chai.expect(tree).to.deep.equal(expected);
  });

  it("Appends different paths", () => {
    const tree = {};
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

    mergePath(["D", "C", "B", "A"], tree);
    mergePath(["D", "B", "A"], tree);

    chai.expect(tree).to.deep.equal(expected);
  });

});
