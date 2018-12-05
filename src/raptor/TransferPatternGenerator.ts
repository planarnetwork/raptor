import {ConnectionIndex, getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {isTransfer, ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {RouteScannerFactory} from "./RouteScanner";

export class TransferPatternGenerator {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: Stop[],
    private readonly routeScannerFactory: RouteScannerFactory,
    private readonly departureTimesAtStop: Record<Stop, Time[]>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public create(origin: Stop, dateObj: Date): TransferPattern {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const results = { [origin]: [] };

    for (const time of this.departureTimesAtStop[origin]) {
      const kConnections = this.raptor.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, time);

      this.merge(results, kConnections);
    }

    return results;
  }

  private merge(results: TransferPattern, kConnections: ConnectionIndex): void {
    for (const finalDestination in kConnections) {
      for (const k in kConnections[finalDestination]) {
        for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
          const connection = kConnections[destination][i];
          const origin = isTransfer(connection) ? connection.origin : connection[0].stopTimes[connection[1]].stop;

          if (!results[destination]) {
            results[destination] = [origin];
          }
          else if (!results[destination].includes(origin)
            && (!results[origin] || !results[origin].includes(destination))) {
            results[destination].push(origin);
          }

          destination = origin;
        }
      }
    }
  }
}

export type TransferPattern = Record<Stop, Stop[]>;
