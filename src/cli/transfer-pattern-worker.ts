import { parentPort, workerData } from "node:worker_threads";
import type { StopID, Transfer } from "@gb-transit/gtfs-loader";
import type { Network } from "../network/Network.js";
import type { Timetable } from "../network/Timetable.js";
import { TransferPatternQuery } from "../query/TransferPatternQuery.js";
import { TransferPatternFile } from "../transfer-pattern/TransferPatternFile.js";
import { StringResults } from "../transfer-pattern/results/StringResults.js";

/**
 * Worker that finds transfer patterns for a given station.
 *
 * It is given the timetable rather than a feed to build one from. The timetable is allocated on
 * SharedArrayBuffers, so every worker reads the one the main thread built instead of loading the
 * feed again, and building a pattern needs nothing else from it: naming a path takes the stop ids
 * and the transfers, both of which are small enough to copy.
 *
 * Its patterns go straight to a file of its own, which the run merges once every station is done.
 * Folding them into a tree needs all of them in order, so a worker cannot do that part alone.
 */
interface WorkerInput {
  timetable: Timetable;
  stopIds: StopID[];
  transfers: Transfer[];
  stations: Map<StopID, StopID>;
  date: string;
  output: string;
}

function worker({ timetable, stopIds, transfers, stations, date, output }: WorkerInput): void {
  const network: Network = {
    timetable,
    stopIds,
    stopIndex: new Map(stopIds.map((stop, index) => [stop, index])),
    stations,
    transfers,
    // the feed's trips are the hundreds of megabytes this worker exists to do without. They name
    // the stop times of a journey, and a transfer pattern does not carry those: the only thing
    // that reached for them was the departure a path is dated by, which is in the timetable too
    trips: []
  };

  const query = new TransferPatternQuery(network, () => new StringResults());
  const planFor = new Date(date);
  const patterns = new TransferPatternFile(output);

  parentPort?.on("message", async (stop: StopID | null) => {
    // nothing left to plan, so finish the file before the run takes this thread away
    if (stop === null) {
      await patterns.close();
      parentPort?.postMessage("done");

      return;
    }

    await patterns.store(query.plan(stop, planFor));
    parentPort?.postMessage("ready");
  });

  parentPort?.postMessage("ready");
}

if (workerData) {
  worker(workerData as WorkerInput);
}
