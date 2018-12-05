import {RaptorQueryFactory} from "../src/raptor/RaptorQueryFactory";
import {loadGTFS} from "../src/gtfs/GTFSLoader";
import {TransferPattern} from "../src/raptor/TransferPatternGenerator";
import {Stop} from "../src/gtfs/GTFS";

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const raptor = RaptorQueryFactory.createTransferPatternGenerator(
    trips,
    transfers,
    interchange,
    calendars,
    new Date("2018-12-05")
  );

  console.timeEnd("pre-processing");

  console.time("patterns");
  const results = raptor.create("PET", new Date("2018-12-05"));
  console.timeEnd("patterns");

  // console.log(results);

  console.time("paths");
  const paths = getPaths(results, [], "PET", "BHI");
  console.timeEnd("paths");

  console.log("Results:");
  console.log(paths);
  console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
}

function getPaths(graph: TransferPattern, path: Stop[], origin: Stop, current: Stop): Stop[][] {
  // put the current node at the head of the list
  path.unshift(current);

  if (current === origin) {
    return [path];
  }
  else {
    const paths = [] as Stop[][];

    // return paths to all parent nodes until the root node is reached
    for (const previous of graph[current]) {
      paths.push(...getPaths(graph, path.slice(), origin, previous));
    }

    return paths;
  }
}

run().catch(e => console.error(e));
