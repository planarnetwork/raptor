import {loadGTFS} from "../src/gtfs/GTFSLoader";
import {StringResults} from "../src/transfer-pattern/results/StringResults";
import * as fs from "fs";
import { RaptorAlgorithmFactory } from "../src/raptor/RaptorAlgorithmFactory";
import { TransferPatternQuery } from "../src/query/TransferPatternQuery";

async function run() {
  console.time("initial load");
  const stream = fs.createReadStream("/home/linus/Downloads/gb-rail-latest.zip");
  const [trips, transfers, interchange, calendars] = await loadGTFS(stream);
  console.timeEnd("initial load");

  console.time("pre-processing");
  const date = new Date("2019-06-05");
  const startHeap = process.memoryUsage().heapUsed;
  const raptor = RaptorAlgorithmFactory.create(
    trips,
    transfers,
    interchange,
    calendars,
    date
  );

  const query = new TransferPatternQuery(raptor, () => new StringResults());

  const endHeap = process.memoryUsage().heapUsed;
  console.timeEnd("pre-processing");

  console.time("patterns");
  const results = query.plan("PET", date);
  console.timeEnd("patterns");

  console.time("paths");
  const paths = Array.from(results["BHIPET"]);
  console.timeEnd("paths");

  console.log("Results:");
  console.log(paths);
  console.log(`Memory usage: ${Math.round(((endHeap - startHeap) / 1024 / 1024) * 100) / 100} MB`);
}

run().catch(e => console.error(e));
