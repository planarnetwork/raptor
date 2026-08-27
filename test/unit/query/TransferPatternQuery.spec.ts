import { describe, it, expect } from "vitest";
import { createNetwork } from "../../../src/network/Network";
import { TransferPatternQuery } from "../../../src/query/TransferPatternQuery";
import { StringResults } from "../../../src/transfer-pattern/results/StringResults";
import { feed, st, t, tf } from "../util";

describe("TransferPatternQuery", () => {

  it("finds the pattern of a direct journey", () => {
    const network = createNetwork(feed([t(st("A", null, 1000), st("B", 1100, null))]));
    const query = new TransferPatternQuery(network, () => new StringResults({}));

    // an empty pattern is a direct journey, the origin and destination are not part of it
    expect(query.plan("A", new Date("2018-10-16"))).toEqual({ AB: new Set([""]) });
  });

  it("records the stop a journey changes at", () => {
    const trips = [
      t(st("A", null, 1000), st("B", 1030, null)),
      t(st("B", null, 1100), st("C", 1130, null))
    ];

    const network = createNetwork(feed(trips));
    const query = new TransferPatternQuery(network, () => new StringResults({}));
    const patterns = query.plan("A", new Date("2018-10-16"));

    expect(patterns.AB).toEqual(new Set([""]));
    expect(patterns.AC).toEqual(new Set(["B"]));
  });

  it("records the stop a journey transfers at", () => {
    const trips = [
      t(st("A", null, 1000), st("B", 1030, null)),
      t(st("C", null, 1100), st("D", 1130, null))
    ];

    const network = createNetwork(feed(trips, { B: [tf("B", "C", 60)] }));
    const query = new TransferPatternQuery(network, () => new StringResults({}));

    expect(query.plan("A", new Date("2018-10-16")).AD).toEqual(new Set(["B,C"]));
  });

  it("finds nothing from an origin the feed has no stop for", () => {
    const network = createNetwork(feed([t(st("A", null, 1000), st("B", 1100, null))]));
    const query = new TransferPatternQuery(network, () => new StringResults({}));

    expect(query.plan("Z", new Date("2018-10-16"))).toEqual({});
  });

  it("rejects a date the timetable has no calendar for", () => {
    const network = createNetwork(feed([t(st("A", null, 1000), st("B", 1100, null))]));
    const query = new TransferPatternQuery(network, () => new StringResults({}));

    expect(() => query.plan("A", new Date("2031-04-18")))
      .toThrow(/covers 20180101 to 20201231, so it cannot plan for 20310418/);
  });

});
