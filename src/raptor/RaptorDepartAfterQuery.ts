import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {RouteScannerFactory} from "./RouteScanner";
import {ResultsFactory} from "../results/ResultsFactory";
import {keyValue} from "ts-array-utils";

export class RaptorDepartAfterQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: Stop[],
    private readonly routeScannerFactory: RouteScannerFactory,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: Stop, destination: Stop, dateObj: Date, departureTime: Time): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const kConnections = this.raptor.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, departureTime);

    return this.resultsFactory.getResults(kConnections, destination);
  }
}