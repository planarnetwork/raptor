import {loadGTFS} from "./gtfs/GTFSLoader";
import {StringResults} from "./transfer-pattern/results/StringResults";
import {TransferPatternRepository} from "./transfer-pattern/TransferPatternRepository";
import * as fs from "fs";
import { RaptorAlgorithmFactory } from "./raptor/RaptorAlgorithmFactory";
import { TransferPatternQuery } from "./query/TransferPatternQuery";

/**
 * Worker that finds transfer patterns for a given station
 */
async function worker(filename: string, date: Date): Promise<void> {
  const stream = fs.createReadStream(filename);
  const [trips, transfers, interchange] = await loadGTFS(stream);
  const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, date);

  const query = new TransferPatternQuery(raptor, () => new StringResults(interchange));
  const repository = new TransferPatternRepository(getDatabase());

  process.on("message", async stop => {
    const results = query.plan(stop, date);

    await repository.storeTransferPatterns(results);

    morePlease();
  });

  process.on("SIGUSR2", () => {
    process.exit();
  });

  morePlease();
}

function morePlease() {
  (process as any).send("ready");
}

function getDatabase() {
  return require("mysql2/promise").createPool({
    // host: process.env.DATABASE_HOSTNAME || "localhost",
    socketPath: "/run/mysqld/mysqld.sock",
    user: process.env.DATABASE_USERNAME || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.OJP_DATABASE_NAME || "ojp",
    connectionLimit: 3,
  });
}

if (process.argv[2] && process.argv[3]) {
  worker(process.argv[2], new Date(process.argv[3])).catch(err => {
    console.error(err);
    process.exit();
  });
}
else {
  console.log("Please specify a date and GTFS file.");
}
