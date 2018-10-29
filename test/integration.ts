import {AnyLeg, Journey, TimetableLeg} from "../src/GTFS";
import {RaptorFactory} from "../src/Raptor";
import {loadGTFS} from "../src/GTFSLoader";

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorFactory.create(trips, transfers, interchange, calendars);
  console.timeEnd("pre-processing");

  console.time("planning");
  const results = raptor.plan("TBW", "LVC", new Date("2018-10-22"), 36000);
  console.timeEnd("planning");

  console.log("Results:");
  results.map(journeyToString).forEach(s => console.log(s));
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

function journeyToString(j: Journey) {
  const firstLeg = j.legs[0];
  const departureTime = isTimetableLeg(firstLeg) ? firstLeg.stopTimes[0].departureTime : firstLeg.duration;

  return j.legs[0].origin + ":" + departureTime + ",\n"
    + j.legs.map(l => l.destination + ":" + (
      isTimetableLeg(l) ? l.stopTimes[l.stopTimes.length - 1].arrivalTime : "+" + l.duration)
    ).join(",\n") + "\n";
}

run().catch(e => console.error(e));

function isTimetableLeg(connection: AnyLeg): connection is TimetableLeg {
  return (connection as TimetableLeg).stopTimes !== undefined;
}
