import {RaptorFactory} from "../src/Raptor";
import {loadGTFS} from "../src/GTFSLoader";
import {product} from "ts-array-utils";

const queries = [
  [["MRF", "LVC", "LVJ", "LIV", "NRW", "BHM"], ["WWW"]],
  [["TBW", "WWW"], ["HGS", "PDW", "EDB", "CHX", "TON", "AFK", "MRN", "MRF", "LVC", "LVJ", "LIV", "NRW", "BHM"]],
  [["WEY", "PNZ", "YRK"], ["DIS", "RDG", "NEW"]],
  [["BHM", "BMO", "BSW", "BHI"], ["MCO", "MAN", "MCV", "EXD"]],
  [["COV", "RUG"], ["MAN", "MCV"]],
  [["STA", "WWW", "BXB"], ["MAN", "IPS", "PBO", "DVP"]],
  [["MAN", "MCV"], ["CBW", "CBE"]],
  [
    ["MAN", "MCV", "BHM", "BMO", "BSW", "BHI", "ORP", "TBW", "NRW"],
    [
      "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
      "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
    ]
  ]
];

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorFactory.create(trips, transfers, interchange, calendars);
  console.timeEnd("pre-processing");

  console.time("planning");
  const date = new Date();
  let numResults = 0;

  for (let i = 0; i < 1; i++) {
    for (const [origins, destinations] of queries) {
      for (const [origin, destination] of product(origins, destinations)) {
        console.time(origin + destination);
        const results = raptor.plan(origin, destination, date, 36000);
        console.timeEnd(origin + destination);

        if (results.length === 0) {
          console.log("No results between " + origin + " and " + destination);
        }

        numResults += results.length;
      }
    }
  }

  console.timeEnd("planning");
  console.log("Num journeys: " + numResults);
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

run().catch(e => console.error(e));
