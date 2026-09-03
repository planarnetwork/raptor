import * as cp  from "node:child_process";
import ProgressBar from "progress";
import * as fs from "node:fs";
import type {StopID} from "../gtfs/GTFS.js";
import * as os from "node:os";
import { CSVParser } from "../gtfs/CSVParser.js";
import { entityTypeOf } from "../gtfs/EntityType.js";
import { toChunks } from "../gtfs/Source.js";
import { readZip } from "../gtfs/ZipReader.js";

const numCPUs = os.cpus().length;

async function run(filename: string, dateString: string) {
  const date = new Date(dateString);
  const stops = await getStops(filename);
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

  for (let i = 0; i < Math.min(numCPUs - 2, stops.length); i++) {
    const worker = cp.fork(`${__dirname}/transfer-pattern-worker`, [filename, date.toISOString()]);

    worker.on("message", () => {
      if (stops.length > 0) {
        bar.tick();

        worker.send(stops.pop()!);
      }
      else {
        worker.kill("SIGUSR2");
      }
    });

  }

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
