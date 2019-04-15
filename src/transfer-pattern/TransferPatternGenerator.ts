import {
  ConnectionIndex,
  getDateNumber,
  Interchange,
  RaptorAlgorithm,
  TransfersByOrigin
} from "../raptor/RaptorAlgorithm";
import {CalendarIndex, DayOfWeek, StopID, Time, Trip} from "../gtfs/GTFS";
import {RaptorQueryFactory} from "../raptor/RaptorQueryFactory";

/**
 * Uses the Raptor algorithm to perform full day range queries and send the results to the resultFactory.
 */
export class TransferPatternGenerator<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultFactory: TransferPatternResultsFactory<T>,
    private readonly departureTimesAtStop: Record<StopID, Time[]>,
  ) {}

  /**
   * Generate generate a full day's set of results and store them using the resultsFactory
   */
  public create(origin: StopID, dateObj: Date): T {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const results = this.resultFactory();

    for (const time of this.departureTimesAtStop[origin] || []) {
      const kConnections = this.raptor.scan(origin, date, dayOfWeek, time);

      results.add(kConnections);
    }

    return results.finalize();
  }

}

/**
 * Results constructor
 */
export type TransferPatternResultsFactory<T> = () => TransferPatternResults<T>;

/**
 * Transfer pattern results
 */
export interface TransferPatternResults<T> {

  add(kConnections: ConnectionIndex): void;

  finalize(): T;

}

/**
 * Creates a transfer pattern string generator
 */
export class TransferPatternGeneratorFactory {

  public static create<T>(
    trips: Trip[],
    transfers: TransfersByOrigin,
    interchange: Interchange,
    calendars: CalendarIndex,
    date: Date,
    resultsFactory: TransferPatternResultsFactory<T>
  ): TransferPatternGenerator<T> {

    const {
      routeStopIndex,
      routePath,
      usefulTransfers,
      stops,
      queueFactory,
      routeScannerFactory,
      departureTimesAtStop
    } = RaptorQueryFactory.create(trips, transfers, interchange, calendars, date);

    return new TransferPatternGenerator(
      new RaptorAlgorithm(
        routeStopIndex,
        routePath,
        usefulTransfers,
        interchange,
        stops,
        queueFactory,
        routeScannerFactory
      ),
      resultsFactory,
      departureTimesAtStop
    );
  }
}
