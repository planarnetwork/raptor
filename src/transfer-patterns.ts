import * as cp  from "child_process";
import * as ProgressBar from "progress";
import * as gtfs from "gtfs-stream";
import * as fs from "fs";
import {StopID} from "./gtfs/GTFS";

const numCPUs = require("os").cpus().length;

async function run(filename: string, dateString: string) {
  const date = new Date(dateString);
  const stops = await getStops(filename);
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

  for (let i = 0; i < Math.min(numCPUs - 2, stops.length); i++) {
    const worker = cp.fork(__dirname + "/transfer-pattern-worker", [filename, date.toISOString()]);

    worker.on("message", () => {
      if (stops.length > 0) {
        bar.tick();

        worker.send(stops.pop());
      }
      else {
        worker.kill("SIGUSR2");
      }
    });

  }

}

async function getStops(filename: string): Promise<StopID[]> {
  return new Promise((resolve, reject) => {
    const stops = [] as StopID[];

    fs.createReadStream(filename)
        .pipe(gtfs({ raw: true }))
        .on("data", entity => entity.type === "stop"
            && entity.data.stop_timezone === "Europe/London"
            && stops.push(entity.data.stop_id)
        )
        .on("error", e => reject(e))
        .on("end", () => resolve(stops));
  });
}

if (process.argv[2] && process.argv[3]) {
  run(process.argv[2], process.argv[3]).catch(e => console.error(e));
}
else {
  console.log("Please specify a GTFS file and date.");
}
