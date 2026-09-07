import { describe, it, expect } from "vitest";
import { createNetwork } from "../../../src/network/Network.js";
import { RaptorAlgorithm } from "../../../src/raptor/RaptorAlgorithm.js";
import { getDateNumber } from "../../../src/query/DateUtil.js";
import { feed, st, t } from "../util.js";

describe("TripScanner", () => {

  it("finds a trip when a route is traversed again from an earlier stop", () => {
    const trips = [
      t(st("A", null, 900), st("M", 915, 915), st("B", 930, 930), st("C", 1000, null)),
      t(st("A", null, 1000), st("M", 1015, 1015), st("B", 1030, 1030), st("C", 1100, null)),
      t(st("A", null, 1100), st("M", 1115, 1115), st("B", 1130, 1130), st("C", 1200, null)),
      // reaches B, so the route above is first traversed from B, boarding its second trip
      t(st("O", null, 1000), st("B", 1015, null)),
      // reaches A from B, so the route is traversed again from A a round later, where only its
      // third trip can be caught. A scan position carried over from the traversal at B starts
      // below that trip and finds nothing
      t(st("B", null, 1020), st("A", 1040, null))
    ];

    const network = createNetwork(feed(trips));
    const raptor = new RaptorAlgorithm(network.timetable);
    const origin = network.stopIndex.get("O") as number;
    const [, arrivals] = raptor.scan(new Map([[origin, 900]]), getDateNumber(new Date("2018-10-16")));

    expect(arrivals[network.stopIndex.get("M") as number]).toBe(1115);
  });

});
