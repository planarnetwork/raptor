import { RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { ResultsFactory } from "../results/ResultsFactory";
import { DayOfWeek, StopID, Time, TimetableLeg } from "../gtfs/GTFS";
import { getDateNumber } from "./DateUtil";
import { AnyLeg, Journey } from "../results/Journey";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RangeQuery<T extends Journey> {

  private readonly ONE_DAY = 24 * 60 * 60;

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a query at midnight, and then continue to search one minute after the earliest departure of each set of
   * results.
   *
   * TODO filter
   */
  public plan(
    origin: StopID,
    destination: StopID,
    dateObj: Date,
    time: number = 1,
    endTime: number = this.ONE_DAY
  ): T[] {

    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const results: T[] = [];

    while (time < endTime) {
      const kConnections = this.raptor.scan(origin, date, dayOfWeek, time);
      const newResults = this.resultsFactory.getResults(kConnections, destination);

      results.push(...newResults);

      if (newResults.length === 0) {
        break;
      }

      time = Math.min(...newResults.map(j => getDepartureTime(j.legs))) + 1;
    }

    return results;
  }

}

// TODO, these need a home
export function isTimetableLeg(connection: AnyLeg): connection is TimetableLeg {
  return (connection as TimetableLeg).stopTimes !== undefined;
}

export function getDepartureTime(legs: AnyLeg[]): Time {
  let transferDuration = 0;

  for (const leg of legs) {
    if (!isTimetableLeg(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg.stopTimes[0].departureTime - transferDuration;
    }
  }

  return 0;
}

export function getArrivalTime(legs: AnyLeg[]): Time {
  let transferDuration = 0;

  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i];

    if (!isTimetableLeg(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg.stopTimes[leg.stopTimes.length - 1].arrivalTime + transferDuration;
    }
  }

  return 0;
}
