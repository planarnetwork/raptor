import * as cp  from "child_process";
import * as ProgressBar from "progress";
import {loadGTFS} from "./gtfs/GTFSLoader";
import {RaptorQueryFactory} from "./raptor/RaptorQueryFactory";
import {ChildProcess} from "child_process";
import {Calendar, Trip} from "./gtfs/GTFS";
import {Interchange, TransfersByOrigin} from "./raptor/RaptorAlgorithm";

const numCPUs = require("os").cpus().length;

async function run() {
  const gtfs = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  const workers = [] as ChildProcess[];

  for (let i = 0; i < numCPUs - 1; i++) {
    workers.push(cp.fork(__dirname + "/transfer-pattern-worker"));
  }

  let date = new Date();

  while (date.setDate(date.getDate() + 1)) {
    console.time(date.toUTCString());
    await start(workers, gtfs, date);
    console.timeEnd(date.toUTCString());
  }

}

function start(workers: ChildProcess[], gtfs: [Trip[], TransfersByOrigin, Interchange, Calendar[]], date: Date) {
  return new Promise(resolve => {
    const [trips, transfers, interchange, calendars] = gtfs;
    const {stops} = RaptorQueryFactory.create(trips, transfers, interchange, calendars, date);
    const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

    let finishedWorkers = 0;
    let stopI = 0;

    for (const worker of workers) {
      worker.on("message", message => {
        if (message === "date") {
          console.log("Sending " + date.toString());
          worker.send(date.toString());
        }
        else {
          if (stopI < stops.length) {
            bar.tick();

            worker.send(stops[stopI++]);
          }
          else {
            finishedWorkers++;

            if (finishedWorkers === workers.length) {
              bar.terminate();

              resolve();
            }
          }
        }
      });
    }
  });
}

run().catch(e => console.error(e));
