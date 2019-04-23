import { ConnectionIndex, RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID, Time } from "../gtfs/GTFS";
import { ResultsFactory } from "../results/ResultsFactory";
import { getDateNumber } from "./DateUtil";
import { Journey } from "../results/Journey";
import { JourneyFilter } from "../results/filter/JourneyFilter";

/**
 * Implementation of Raptor that searches for journeys between a set of origin and destinations.
 *
 * Only returns results from a single pass of the Raptor algorithm.
 */
export class GroupStationDepartAfterQuery {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly resultsFactory: ResultsFactory,
    private readonly maxSearchDays: number = 3,
    private readonly filters: JourneyFilter[] = []
  ) { }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time
   */
  public plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Journey[] {
    // get results for every destination and flatten into a single array
    const results = destinations.flatMap(destination => this.getJourneys(origins, destination, date, time));

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }

  protected getJourneys(origins: StopID[], destination: StopID, startDate: Date, time: Time): Journey[] {
    const connectionIndexes: ConnectionIndex[] = [];

    for (let i = 0; i < this.maxSearchDays; i++) {
      const date = getDateNumber(startDate);
      const dayOfWeek = startDate.getDay() as DayOfWeek;
      const kConnections = this.raptor.scan(origins, date, dayOfWeek, time);

      connectionIndexes.push(kConnections);

      if (Object.keys(kConnections[destination]).length > 0) {
        return this.getJourneysFromConnections(connectionIndexes, destination);
      }

      origins = this.getFoundStations(kConnections);
      startDate.setDate(startDate.getDate() + 1);
    }

    return [];
  }

  private getFoundStations(kConnections: ConnectionIndex): StopID[] {
    return Object
    .keys(kConnections)
    .filter(d => Object.keys(kConnections[d]).length > 0);
  }

  private getJourneysFromConnections(connectionIndexes: ConnectionIndex[], destination: StopID): Journey[] {
    // get the results from the last day
    const results = this.resultsFactory.getResults(connectionIndexes[connectionIndexes.length - 1], destination);

    // recurse through each days results appending the journeys (and merging them in the process)
    return this.completeJourneys(results, connectionIndexes, connectionIndexes.length - 2);
  }

  private completeJourneys(journeys: Journey[], cs: ConnectionIndex[], dayI: number): Journey[] {
    if (dayI < 0) {
      return journeys;
    }

    const results = journeys.flatMap(journeyB => {
      return this.resultsFactory
      .getResults(cs[dayI], journeyB.legs[0].origin)
      .map(journeyA => this.mergeJourneys(journeyA, journeyB));
    });

    return this.completeJourneys(results, cs, dayI - 1);
  }

  private mergeJourneys(journeyA: Journey, journeyB: Journey): Journey {
    return {
      legs: journeyA.legs.concat(journeyB.legs),
      departureTime: journeyA.departureTime,
      arrivalTime: journeyB.arrivalTime + 86400
    };
  }

}
