import {loadGTFS} from "./gtfs/GTFSLoader";
import {TransferPatternGeneratorFactory} from "./transfer-pattern/TransferPatternGenerator";
import {PatternStringGenerator} from "./transfer-pattern/PatternStringGenerator";
import {TransferPatternRepository} from "./transfer-pattern/TransferPatternRepository";
import * as fs from "fs";

/**
 * Worker that finds transfer patterns for a given station
 */
async function worker(filename: string, date: Date): Promise<void> {
  const stream = fs.createReadStream(filename);
  const [trips, transfers, interchange, calendars] = await loadGTFS(stream);

  const raptor = TransferPatternGeneratorFactory.create(
    trips,
    transfers,
    interchange,
    calendars,
    date,
    () => new PatternStringGenerator()
  );
  const repository = new TransferPatternRepository(getDatabase());

  process.on("message", stop => {
    const results = raptor.create(stop, date);

    repository.storeTransferPatterns(results);

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
    host: process.env.DATABASE_HOSTNAME || "localhost",
    user: process.env.DATABASE_USERNAME || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.OJP_DATABASE_NAME || "raptor",
    connectionLimit: 5,
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
