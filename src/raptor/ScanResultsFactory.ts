import { StopID } from "../gtfs/GTFS";
import { StopTimes } from "./RaptorAlgorithm";
import { ScanResults } from "./ScanResults";

export class ScanResultsFactory {

  constructor(
    private readonly stops: StopID[]
  ) {}

  public create(origins: StopTimes): ScanResults {
    const bestArrivals = Object.fromEntries(
      this.stops.map(stop => [stop, origins[stop] || Number.MAX_SAFE_INTEGER])
    );
    const kArrivals = [Object.fromEntries(
      this.stops.map(stop => [stop, origins[stop] || Number.MAX_SAFE_INTEGER])
    )];
    const kConnections = Object.fromEntries(
      this.stops.map(stop => [stop, Object.create(null)])
    );

    return new ScanResults(bestArrivals, kArrivals, kConnections);
  }
}
