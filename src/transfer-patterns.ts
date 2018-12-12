import * as cp  from "child_process";
import * as ProgressBar from "progress";
import {loadGTFS} from "./gtfs/GTFSLoader";
import {RaptorQueryFactory} from "./raptor/RaptorQueryFactory";

const numCPUs = require("os").cpus().length;

async function run() {
  const date = new Date();
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  const {stops} = RaptorQueryFactory.create(trips, transfers, interchange, calendars, date);
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

  for (let i = 0; i < Math.min(numCPUs - 1, stops.length); i++) {
    const worker = cp.fork(__dirname + "/transfer-pattern-worker");

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

run().catch(e => console.error(e));
