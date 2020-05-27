import { Journey } from "../src/results/Journey";
import { loadGTFS } from "../src/gtfs/GTFSLoader";
import { JourneyFactory } from "../src/results/JourneyFactory";
import * as fs from "fs";
import { RaptorAlgorithmFactory } from "../src/raptor/RaptorAlgorithmFactory";
import { MultipleCriteriaFilter } from "../src/results/filter/MultipleCriteriaFilter";
import { GroupStationDepartAfterQuery } from "../src/query/GroupStationDepartAfterQuery";

async function run() {
  const filename = process.argv[2] || "/home/linus/Downloads/gb-rail-latest.zip";
  console.log("Loading " + filename);
  console.time("initial load");
  const stream = fs.createReadStream(filename);
  const [trips, transfers, interchange] = await loadGTFS(stream);
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorAlgorithmFactory.create(
    trips,
    transfers,
    interchange
  );

  const query = new GroupStationDepartAfterQuery(
    raptor,
    new JourneyFactory(),
    3,
    [new MultipleCriteriaFilter()]
  );

  console.timeEnd("pre-processing");

  for (let i = 0; i < 15; i++) {
    console.time("planning");
    const o = process.argv[3] ? [process.argv[3]] : ["BHM", "BMO", "BSW", "BHI"];
    const d = process.argv[4] ? [process.argv[4]] : ["MCO", "MAN", "MCV", "EXD"];
    query.plan(o, d, new Date(), 10 * 60 * 60);
    console.timeEnd("planning");
  }

  const origins = process.argv[3] ? [process.argv[3]] : ["BHM", "BMO", "BSW", "BHI"];
  const destinations = process.argv[4] ? [process.argv[4]] : ["MCO", "MAN", "MCV", "EXD"];
  const results = query.plan(origins, destinations, new Date(), 10 * 60 * 60);
  console.log("Results:");
  results.map(journeyToString).forEach(s => console.log(s));
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

function journeyToString(j: Journey) {
  return toTime(j.departureTime) + ", " +
    toTime(j.arrivalTime) + ", " +
    [j.legs[0].origin, ...j.legs.map(l => l.destination)].join("-");
}

function toTime(time: number) {
  let hours: any   = Math.floor(time / 3600);
  let minutes: any = Math.floor((time - (hours * 3600)) / 60);
  let seconds: any = time - (hours * 3600) - (minutes * 60);

  if (hours   < 10) { hours   = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }

  return hours + ":" + minutes + ":" + seconds;
}

run().catch(e => console.error(e));
