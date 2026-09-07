import { parentPort, workerData } from "node:worker_threads";
import * as mysql from "mysql2/promise";
import type { StopID, Transfer } from "../gtfs/GTFS.js";
import type { Network } from "../network/Network.js";
import type { Timetable } from "../network/Timetable.js";
import { TransferPatternQuery } from "../query/TransferPatternQuery.js";
import { StringResults } from "../transfer-pattern/results/StringResults.js";
import { TransferPatternRepository } from "../transfer-pattern/TransferPatternRepository.js";

/**
 * Worker that finds transfer patterns for a given station.
 *
 * It is given the timetable rather than a feed to build one from. The timetable is allocated on
 * SharedArrayBuffers, so every worker reads the one the main thread built instead of loading the
 * feed again, and building a pattern needs nothing else from it: naming a path takes the stop ids
 * and the transfers, both of which are small enough to copy.
 */
interface WorkerInput {
  timetable: Timetable;
  stopIds: StopID[];
  transfers: Transfer[];
  stations: Map<StopID, StopID>;
  date: string;
}

function getDatabase() {
  return mysql.createPool({
    host: process.env.DATABASE_HOSTNAME || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "3306", 10),
    user: process.env.DATABASE_USERNAME || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.OJP_DATABASE_NAME || "ojp",
    // one query is in flight at a time, and a machine with many cores runs many of these
    connectionLimit: 1,
  });
}

function worker({ timetable, stopIds, transfers, stations, date }: WorkerInput): void {
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
  const repository = new TransferPatternRepository(getDatabase());
  const planFor = new Date(date);

  parentPort?.on("message", async (stop: StopID) => {
    await repository.storeTransferPatterns(query.plan(stop, planFor));

    parentPort?.postMessage("ready");
  });

  parentPort?.postMessage("ready");
}

if (workerData) {
  worker(workerData as WorkerInput);
}
