import { describe, it, expect, afterAll } from "vitest";
import { Worker } from "node:worker_threads";
import * as path from "node:path";
import { createNetwork } from "../../../src/network/Network.js";
import { RaptorAlgorithm } from "../../../src/raptor/RaptorAlgorithm.js";
import { ParallelRaptor } from "../../../src/raptor/ParallelRaptor.js";
import { getDateNumber } from "../../../src/query/DateUtil.js";
import { JourneyFactory } from "../../../src/results/JourneyFactory.js";
import type { ScanWorker } from "../../../src/raptor/ParallelScan.js";
import { feed, st, t, tf } from "../util.js";

const ENTRY = path.join(process.cwd(), "src", "raptor", "parallel-worker.ts");

const trips = [
  t(st("A", null, 1000), st("B", 1030, 1035), st("C", 1100, null)),
  t(st("A", null, 1200), st("B", 1230, 1235), st("C", 1300, null)),
  t(st("A", null, 1400), st("D", 1430, 1435), st("C", 1500, null)),
  t(st("B", null, 1100), st("D", 1130, 1135), st("E", 1200, null)),
  t(st("D", null, 1500), st("E", 1530, null))
];

const network = createNetwork(feed(trips, { C: [tf("C", "E", 60)] }, { B: 120 }, {}));
const date = getDateNumber(new Date("2018-10-16"));
const started: Worker[] = [];

function pool(size: number): ScanWorker[] {
  return Array.from({ length: size }, () => {
    // the worker needs the same typescript loader this test is running under
    const worker = new Worker(ENTRY, { execArgv: ["--import", "tsx"] });

    started.push(worker);

    return worker;
  });
}

afterAll(async () => {
  await Promise.all(started.map(w => w.terminate()));
});

describe("ParallelRaptor", () => {

  it("needs at least one worker", () => {
    expect(() => new ParallelRaptor(network.timetable, [])).toThrow();
  });

  for (const size of [1, 2, 4]) {
    it(`gives the same arrivals as the sequential scan with ${size} worker(s)`, async () => {
      const sequential = new RaptorAlgorithm(network.timetable);
      const parallel = new ParallelRaptor(network.timetable, pool(size), 8, 15000);

      for (const origin of ["A", "B", "D"]) {
        const stop = network.stopIndex.get(origin) as number;
        const [, expected] = sequential.scan(new Map([[stop, 900]]), date);
        const [, actual] = parallel.scan(new Map([[stop, 900]]), date);

        expect(Array.from(actual)).toEqual(Array.from(expected));
      }

      parallel.close();
    });
  }

  it("gives the same journeys as the sequential scan", () => {
    const sequential = new RaptorAlgorithm(network.timetable);
    const parallel = new ParallelRaptor(network.timetable, pool(2), 8, 15000);
    const results = new JourneyFactory();
    const origin = network.stopIndex.get("A") as number;
    const destination = network.stopIndex.get("E") as number;

    const [sequentialConnections] = sequential.scan(new Map([[origin, 900]]), date);
    const [parallelConnections] = parallel.scan(new Map([[origin, 900]]), date);

    const arrivals = (index: typeof sequentialConnections) => results
      .getResults(index, destination, network)
      .map(j => [j.departureTime, j.arrivalTime])
      .sort();

    expect(arrivals(parallelConnections)).toEqual(arrivals(sequentialConnections));
    parallel.close();
  });

  it("can be scanned more than once", () => {
    const sequential = new RaptorAlgorithm(network.timetable);
    const parallel = new ParallelRaptor(network.timetable, pool(2), 8, 15000);
    const origin = network.stopIndex.get("A") as number;

    for (const time of [900, 1100, 1300]) {
      const [, expected] = sequential.scan(new Map([[origin, time]]), date);
      const [, actual] = parallel.scan(new Map([[origin, time]]), date);

      expect(Array.from(actual)).toEqual(Array.from(expected));
    }

    parallel.close();
  });

});
