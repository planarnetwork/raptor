import { Arrivals, ConnectionIndex, RaptorAlgorithm, StopTimes } from "../raptor/RaptorAlgorithm";
import { DayOfWeek, StopID, Time } from "../gtfs/GTFS";
import { ResultsFactory } from "../results/ResultsFactory";
import { getDateNumber } from "./DateUtil";
import { Journey } from "../results/Journey";
import { JourneyFilter } from "../results/filter/JourneyFilter";
import { keyValue } from "ts-array-utils";

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
    // set the departure time for each origin
    const originTimes = origins.reduce(keyValue(origin => [origin, time]), {});

    // get results for every destination and flatten into a single array
    const results = this.getJourneys(originTimes, destinations, date);

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }

  /**
   * Find journeys using the raptor object, if no results are found then increment the day and keep
   * searching until results have been found or the maximum number of days has been reached
   */
  private getJourneys(origins: StopTimes, destinations: StopID[], startDate: Date): Journey[] {
    const connectionIndexes: ConnectionIndex[] = [];

    for (let i = 0; i < this.maxSearchDays; i++) {
      const date = getDateNumber(startDate);
      const dayOfWeek = startDate.getDay() as DayOfWeek;
      const [kConnections, bestArrivals] = this.raptor.scan(origins, date, dayOfWeek);
      const results = this.getJourneysFromConnections(kConnections, connectionIndexes, destinations);

      if (results.length > 0) {
        return results;
      }

      // reset the origin departure times, and increment the day by one
      origins = this.getFoundStations(kConnections, bestArrivals);
      startDate.setDate(startDate.getDate() + 1);
      connectionIndexes.push(kConnections);
    }

    return [];
  }

  /**
   * Take all the stops we've visited and set the departure time for the next day as the best arrival time at that
   * stop minus 1 day. This prevents invalid departures where the arrival time at a stop is greater than 24 hours
   * e.g. arriving at 28:30 but departing at 04:00 the next day.
   */
  private getFoundStations(kConnections: ConnectionIndex, bestArrivals: Arrivals): StopTimes {
    const allStops = Object.keys(kConnections);
    const stopsWithAnArrival =  allStops.filter(d => Object.keys(kConnections[d]).length > 0);

    // create the origin departure times by subtracting 1 day from the best arrival time
    return stopsWithAnArrival.reduce(keyValue(s => [s, Math.max(1, bestArrivals[s] - 86400)]), {});
  }

  /**
   * Create journeys that may span multiple days by stitching together multiple kConnection results
   * into individual journeys.
   */
  private getJourneysFromConnections(
    kConnections: ConnectionIndex,
    prevConnections: ConnectionIndex[],
    destinations: StopID[]
  ): Journey[] {

    const destinationsWithResults = destinations.filter(d => Object.keys(kConnections[d]).length > 0);
    const initialResults = destinationsWithResults.flatMap(d => this.resultsFactory.getResults(kConnections, d));

    // reverse the previous connections and then work back through each day pre-pending journeys
    return prevConnections
      .reverse()
      .reduce((journeys, connections) => this.completeJourneys(journeys, connections), initialResults);
  }

  /**
   * Reducer that takes the current list of journeys and prepends results based on the given kConnections
   */
  private completeJourneys(results: Journey[], kConnections: ConnectionIndex): Journey[] {
    // for every results we have so far
    return results.flatMap(journeyB => {
      // find some results to the origin of that result and merge them together
      return this.resultsFactory
        .getResults(kConnections, journeyB.legs[0].origin)
        .map(journeyA => this.mergeJourneys(journeyA, journeyB));
    });
  }

  /**
   * Add journey B to the end of journey A and correct the arrival / departure times
   */
  private mergeJourneys(journeyA: Journey, journeyB: Journey): Journey {
    return {
      legs: journeyA.legs.concat(journeyB.legs),
      departureTime: journeyA.departureTime,
      arrivalTime: journeyB.arrivalTime + 86400
    };
  }

}
