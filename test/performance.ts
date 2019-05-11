import { loadGTFS } from "../src/gtfs/GTFSLoader";
import { JourneyFactory } from "../src/results/JourneyFactory";
import * as fs from "fs";
import { RaptorAlgorithmFactory } from "../src/raptor/RaptorAlgorithmFactory";
import { GroupStationDepartAfterQuery } from "../src/query/GroupStationDepartAfterQuery";

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
  const stream = fs.createReadStream("/home/linus/Downloads/gb-rail-latest.zip");
  const [trips, transfers, interchange, calendars] = await loadGTFS(stream);
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
  const query = new GroupStationDepartAfterQuery(raptor, new JourneyFactory());
  console.timeEnd("pre-processing");

  const date = new Date();
  let numResults = 0;

  console.time("Planning");

  for (let i = 0; i < 3; i++) {
    for (const [origins, destinations] of queries) {

      const results = query.plan(origins, destinations, date, 22 * 60 * 60);

      numResults += results.length;
    }
  }

  console.timeEnd("Planning");
  console.log("Num journeys: " + numResults);
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

run().catch(e => console.error(e));
