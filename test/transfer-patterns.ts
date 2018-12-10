import {RaptorQueryFactory} from "../src/raptor/RaptorQueryFactory";
import {loadGTFS} from "../src/gtfs/GTFSLoader";
import {TreeNode} from "../src/raptor/TransferPatternGenerator";
import {Stop} from "../src/gtfs/GTFS";

async function run() {
  console.time("initial load");
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  console.timeEnd("initial load");

  console.time("pre-processing");
  const startHeap = process.memoryUsage().heapUsed;
  const raptor = RaptorQueryFactory.createTransferPatternGenerator(
    trips,
    transfers,
    interchange,
    calendars,
    new Date("2018-12-10")
  );

  const endHeap = process.memoryUsage().heapUsed;
  console.timeEnd("pre-processing");

  console.time("patterns");
  const results = raptor.create("PET", new Date("2018-12-05"));
  console.timeEnd("patterns");

  console.time("paths");
  const paths = results["BHI"].map(leaf => getPath(leaf, []));
  console.timeEnd("paths");

  console.log("Results:");
  console.log(paths);
  console.log(`Memory usage: ${Math.round(((endHeap - startHeap) / 1024 / 1024) * 100) / 100} MB`);
}

function getPath(node: TreeNode, path: Stop[]): Stop[] {
  path.unshift(node.label);

  return node.parent ? getPath(node.parent, path) : path;
}

run().catch(e => console.error(e));
