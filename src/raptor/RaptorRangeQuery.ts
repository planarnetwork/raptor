import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {RouteScannerFactory} from "./RouteScanner";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RaptorRangeQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: Stop[],
    private readonly routeScannerFactory: RouteScannerFactory,
    private readonly departureTimesAtStop: Record<Stop, Time[]>,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: Stop, destination: Stop, dateObj: Date): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const times = this.departureTimesAtStop[origin];

    return times.reduce((results, time) => {
      const kConnections = this.raptor.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, time);
      const journeys = this.resultsFactory.getResults(kConnections, destination);

      return results.concat(journeys);
    }, [] as T[]).reverse();
  }
}
