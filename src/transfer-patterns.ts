import * as cp  from "child_process";
import * as ProgressBar from "progress";
import {loadGTFS} from "./gtfs/GTFSLoader";
import * as fs from "fs";

const numCPUs = require("os").cpus().length;

async function run(filename: string) {
  const date = new Date();
  const stream = fs.createReadStream(filename);
  const [trips, transfers, interchange, calendars, stopIndex] = await loadGTFS(stream);
  const stops = Object.keys(stopIndex);
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

  for (let i = 0; i < Math.min(numCPUs - 1, stops.length); i++) {
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

if (process.argv[2]) {
  run(process.argv[2]).catch(e => console.error(e));
}
else {
  console.log("Please specify a GTFS file.");
}
