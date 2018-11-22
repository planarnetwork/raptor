import {AnyLeg, Journey, Time, TimetableLeg} from "../src/GTFS";
import {RaptorFactory} from "../src/Raptor";
import {loadGTFS} from "../src/GTFSLoader";

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorFactory.create(trips, transfers, interchange, calendars, new Date("2018-11-23"));
  console.timeEnd("pre-processing");

  console.time("planning");
  const results = raptor.range("HIB", "PDW", new Date());
  console.timeEnd("planning");

  console.log("Results:");
  results.map(journeyToString).forEach(s => console.log(s));
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

function journeyToString(j: Journey) {
  const departure = getDepartureTime(j.legs);
  const arrival = getArrivalTime(j.legs);

  return toTime(departure) + ", " +
    toTime(arrival) + ", " +
    [j.legs[0].origin, ...j.legs.map(l => l.destination)].join("-");
}

function isTimetableLeg(connection: AnyLeg): connection is TimetableLeg {
  return (connection as TimetableLeg).stopTimes !== undefined;
}

function getDepartureTime(legs: AnyLeg[]): Time {
  let transferDuration = 0;

  for (const leg of legs) {
    if (!isTimetableLeg(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg.stopTimes[0].departureTime - transferDuration;
    }
  }

  return 0;
}

function getArrivalTime(legs: AnyLeg[]): Time {
  let transferDuration = 0;

  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i];

    if (!isTimetableLeg(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg.stopTimes[leg.stopTimes.length - 1].arrivalTime + transferDuration;
    }
  }

  return 0;
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
