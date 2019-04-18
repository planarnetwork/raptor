import * as chai from "chai";
import { QueueFactory } from "../../../src/raptor/QueueFactory";

describe("QueueFactory", () => {

  it("enqueues stops", () => {
    const factory = new QueueFactory({
      "StopA": ["RouteA", "RouteB"],
      "StopB": ["RouteB", "RouteC"]
    }, {
      "RouteA": {
        "StopA": 1
      },
      "RouteB": {
        "StopA": 2,
        "StopB": 1
      },
      "RouteC": {
        "StopB": 1
      }
    });

    const actual = factory.getQueue(["StopA", "StopB"]);
    const expected = {
      "RouteA": "StopA",
      "RouteB": "StopB",
      "RouteC": "StopB"
    };

    chai.expect(actual).to.deep.equal(expected);
  });

  it("picks the earliest stop on the route", () => {
    const factory = new QueueFactory({
      "StopA": ["RouteA", "RouteB"],
      "StopB": ["RouteB", "RouteC"]
    }, {
      "RouteA": {
        "StopA": 1
      },
      "RouteB": {
        "StopA": 1,
        "StopB": 2
      },
      "RouteC": {
        "StopB": 1
      }
    });

    const actual = factory.getQueue(["StopB", "StopA"]);
    const expected = {
      "RouteA": "StopA",
      "RouteB": "StopA",
      "RouteC": "StopB"
    };

    chai.expect(actual).to.deep.equal(expected);
  });

});
