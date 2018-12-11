import {loadGTFS} from "./gtfs/GTFSLoader";
import {TransferPatternGeneratorFactory} from "./transfer-pattern/TransferPatternGenerator";
import {PatternStringGenerator} from "./transfer-pattern/PatternStringGenerator";

/**
 * Worker that finds transfer patterns for a given station
 */
async function worker(): Promise<void> {
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  const raptor = TransferPatternGeneratorFactory.create(
    trips,
    transfers,
    interchange,
    calendars,
    new Date("2018-12-10"),
    () => new PatternStringGenerator()
  );

  const date = new Date();

  process.on("message", stop => {
    const results = raptor.create(stop, date);

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

worker().catch(err => {
  console.error(err);
  process.exit();
});
