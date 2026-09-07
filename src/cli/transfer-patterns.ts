import ProgressBar from "progress";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import type { StopID } from "../gtfs/GTFS.js";
import { CSVParser } from "../gtfs/CSVParser.js";
import { entityTypeOf } from "../gtfs/EntityType.js";
import { loadGTFS } from "../gtfs/GTFSLoader.js";
import { toChunks } from "../gtfs/Source.js";
import { readZip } from "../gtfs/ZipReader.js";
import { canShareMemory } from "../network/SharedMemory.js";
import { createNetwork } from "../network/Network.js";

/**
 * Build the timetable once and give it to every worker, rather than every worker building its own.
 *
 * The timetable is allocated on SharedArrayBuffers, so it crosses to a worker as shared memory. A
 * worker that only makes transfer patterns needs nothing else of any size: the feed it was built
 * from is hundreds of megabytes and is only needed to name a journey's stop times, which a pattern
 * does not carry.
 */
async function run(filename: string, dateString: string) {
  const date = new Date(dateString);
  const stops = await getStops(filename);

  console.log(`Loading ${filename}`);

  const feed = await loadGTFS(fs.createReadStream(filename));
  const network = createNetwork(feed, date);

  if (!canShareMemory) {
    console.warn("SharedArrayBuffer is not available, so each worker will be given a copy of the timetable");
  }

  const workers = Math.min(
    Number(process.env.WORKERS) || os.cpus().length - 2,
    stops.length
  );

  console.log(`Planning ${stops.length} stops on ${workers} workers`);

  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });
  const workerData = {
    timetable: network.timetable,
    stopIds: network.stopIds,
    transfers: network.transfers,
    stations: network.stations,
    date: date.toISOString()
  };

  await Promise.all(Array.from({ length: workers }, () => new Promise<void>((resolve, reject) => {
    const worker = new Worker(workerFile(), { workerData });

    worker.on("message", () => {
      const stop = stops.pop();

      if (stop === undefined) {
        resolve();
        worker.terminate();
      }
      else {
        bar.tick();
        worker.postMessage(stop);
      }
    });

    worker.on("error", reject);
  })));
}

/**
 * The worker, whether this is running from source or from the build. A Worker is given an exact
 * path rather than a module to resolve, so the extension has to be settled here.
 */
function workerFile(): string {
  const candidates = ["transfer-pattern-worker.js", "transfer-pattern-worker.ts"]
    .map(file => path.join(__dirname, file));
  const worker = candidates.find(file => fs.existsSync(file));

  if (worker === undefined) {
    throw new Error(`Could not find the transfer pattern worker, looked in ${candidates.join(" and ")}`);
  }

  return worker;
}

/**
 * Reads stops.txt on its own rather than loading the whole feed, since the stop ids are all this
 * needs and the rest of a feed is expensive to build. stop_timezone is read directly because the
 * loader does not keep it.
 */
async function getStops(filename: string): Promise<StopID[]> {
  const stops = [] as StopID[];

  await readZip(toChunks(fs.createReadStream(filename)), entry => {
    if (entityTypeOf(entry.name) !== "stop") {
      return undefined;
    }

    // only the stations, and named the way the algorithm names them. A feed that identifies
    // platforms individually gives them the same timezone, so they are excluded by having a
    // parent rather than by their timezone
    const parser = new CSVParser(["stop_id", "stop_code", "stop_timezone", "parent_station"], row => {
      if (row.stop_timezone === "Europe/London" && row.parent_station === undefined) {
        stops.push(row.stop_code ?? row.stop_id as StopID);
      }
    });

    return (text, final) => {
      parser.write(text);

      if (final) {
        parser.end();
      }
    };
  });

  return stops;
}

if (process.argv[2] && process.argv[3]) {
  run(process.argv[2], process.argv[3]).catch(e => console.error(e));
}
else {
  console.log("Please specify a GTFS file and date.");
}
