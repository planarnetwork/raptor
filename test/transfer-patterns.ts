import {loadGTFS} from "../src/gtfs/GTFSLoader.js";
import {StringResults} from "../src/transfer-pattern/results/StringResults.js";
import * as fs from "node:fs";
import { createNetwork } from "../src/network/Network.js";
import { TransferPatternQuery } from "../src/query/TransferPatternQuery.js";

async function run() {
  console.time("initial load");
  const stream = fs.createReadStream("/home/linus/Downloads/gb-rail-latest.zip");
  const feed = await loadGTFS(stream);
  console.timeEnd("initial load");

  console.time("pre-processing");
  const date = new Date("2019-06-05");
  const startHeap = process.memoryUsage().heapUsed;
  const network = createNetwork(feed, date);

  const query = new TransferPatternQuery(network, () => new StringResults(feed.interchange));

  const endHeap = process.memoryUsage().heapUsed;
  console.timeEnd("pre-processing");

  console.time("patterns");
  const results = query.plan("PET", date);
  console.timeEnd("patterns");

  console.time("paths");
  const paths = Array.from(results.BHIPET);
  console.timeEnd("paths");

  console.log("Results:");
  console.log(paths);
  console.log(`Memory usage: ${Math.round(((endHeap - startHeap) / 1024 / 1024) * 100) / 100} MB`);
}

run().catch(e => console.error(e));
