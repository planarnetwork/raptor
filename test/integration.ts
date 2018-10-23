import {Journey} from "../src/GTFS";
import {Raptor} from "../src/Raptor";
import {loadGTFS} from "../src/GTFSLoader";

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = new Raptor(trips, transfers, interchange, calendars);
  console.timeEnd("pre-processing");

  console.time("planning");
  const results = raptor.plan("EDB", "TBW", new Date("2018-10-22"));
  console.timeEnd("planning");

  console.log("Results:");
  results.map(journeyToString).forEach(s => console.log(s));
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

function journeyToString(j: Journey) {
  return j.legs[0].origin + "," + j.legs.map(l => l.destination).join(",");
}

run().catch(e => console.error(e));
