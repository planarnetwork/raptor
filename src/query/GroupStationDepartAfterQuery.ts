import type { ConnectionIndex } from "../raptor/Connection";
import { type Origins, RaptorAlgorithm } from "../raptor/RaptorAlgorithm";
import type { StopID, Time } from "../gtfs/GTFS";
import type { Network } from "../network/Network";
import type { ResultsFactory } from "../results/ResultsFactory";
import { checkCovered, getDateNumber } from "./DateUtil";
import type { Journey } from "../results/Journey";
import type { JourneyFilter } from "../results/filter/JourneyFilter";
import { NOT_REACHED, type StopIdx } from "../network/Timetable";
import type { Arrivals } from "../raptor/ScanResults";

/**
 * Implementation of Raptor that searches for journeys between a set of origin and destinations.
 *
 * Only returns results from a single pass of the Raptor algorithm.
 */
export class GroupStationDepartAfterQuery {

  private readonly raptor: RaptorAlgorithm;

  constructor(
    private readonly network: Network,
    private readonly resultsFactory: ResultsFactory,
    private readonly maxSearchDays: number = 3,
    private readonly filters: JourneyFilter[] = []
  ) {
    this.raptor = new RaptorAlgorithm(network.timetable);
  }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time
   */
  public plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Journey[] {
    checkCovered(this.raptor, getDateNumber(date));

    // the algorithm works in stop indexes, the query in the ids the caller knows
    const originTimes: Origins = new Map(this.toStopIndexes(origins).map(stop => [stop, time]));

    // get results for every destination and flatten into a single array
    const results = this.getJourneys(originTimes, this.toStopIndexes(destinations), date);

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), results);
  }

  /**
   * Find journeys using the raptor object, if no results are found then increment the day and keep
   * searching until results have been found or the maximum number of days has been reached
   */
  private getJourneys(origins: Origins, destinations: StopIdx[], startDate: Date): Journey[] {
    const connectionIndexes: ConnectionIndex[] = [];

    for (let i = 0; i < this.maxSearchDays; i++) {
      const [kConnections, bestArrivals] = this.raptor.scan(origins, getDateNumber(startDate));
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
  private getFoundStations(kConnections: ConnectionIndex, bestArrivals: Arrivals): Origins {
    const origins: Origins = new Map();

    // create the origin departure times by subtracting 1 day from the best arrival time
    for (let stop = 0; stop < kConnections.length; stop++) {
      if (kConnections[stop].length > 0 && bestArrivals[stop] !== NOT_REACHED) {
        origins.set(stop, Math.max(1, bestArrivals[stop] - 86400));
      }
    }

    return origins;
  }

  private toStopIndexes(stops: StopID[]): StopIdx[] {
    return stops
      .map(stop => this.network.stopIndex.get(stop))
      .filter(stop => stop !== undefined);
  }

  /**
   * Create journeys that may span multiple days by stitching together multiple kConnection results
   * into individual journeys.
   */
  private getJourneysFromConnections(
    kConnections: ConnectionIndex,
    prevConnections: ConnectionIndex[],
    destinations: StopIdx[]
  ): Journey[] {

    const destinationsWithResults = destinations.filter(d => kConnections[d].length > 0);
    const initialResults = destinationsWithResults
      .flatMap(d => this.resultsFactory.getResults(kConnections, d, this.network));

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
      const origin = this.network.stopIndex.get(journeyB.legs[0].origin) as StopIdx;

      return this.resultsFactory
        .getResults(kConnections, origin, this.network)
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
