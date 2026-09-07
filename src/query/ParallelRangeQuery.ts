import { getDateNumber } from "@gb-transit/gtfs-loader";
import type { StopID, Time } from "@gb-transit/gtfs-loader";
import type { Network } from "../network/Network.js";
import type { Journey } from "../results/Journey.js";
import type { JourneyFilter } from "../results/filter/JourneyFilter.js";
import type { AsyncPlanner } from "./AsyncPlanner.js";
import { dayOffset, NOT_COVERED } from "../network/TripCalendar.js";

const ONE_DAY = 24 * 60 * 60;

/**
 * A range query that scans several departure times at once.
 *
 * RangeQuery has to be sequential: it scans, looks at what came back, and starts the next scan a
 * second after the earliest journey it found. Nothing can be started until the previous scan has
 * answered. The departure times it lands on are not a secret though, they are the times trips
 * leave the origin, and the timetable already holds those. Reading them up front turns the query
 * into a list of independent scans, which can be handed to as many planners as there are.
 *
 * The scans are run in batches the size of the pool, and the results are counted after each batch,
 * so a query that only wants a few journeys stops early. That is the reason for batching rather
 * than dispatching the whole day: the work wasted by stopping late is bounded by one batch instead
 * of by however much of the day is left.
 */
export class ParallelRangeQuery {

  constructor(
    private readonly network: Network,
    private readonly planners: AsyncPlanner[],
    private readonly filters: JourneyFilter[] = []
  ) {
    if (planners.length === 0) {
      throw new Error("A ParallelRangeQuery needs at least one planner");
    }
  }

  /**
   * Plan journeys departing within the given range, stopping once maxResults of them have been
   * found rather than covering the whole range.
   */
  public async plan(
    origin: StopID,
    destination: StopID,
    date: Date,
    time: Time = 1,
    endTime: Time = ONE_DAY,
    maxResults: number = Number.MAX_SAFE_INTEGER
  ): Promise<Journey[]> {
    const departures = this.departureTimes(origin, date, time, endTime);
    const results: Journey[] = [];

    for (let i = 0; i < departures.length; i += this.planners.length) {
      const batch = departures.slice(i, i + this.planners.length);
      const found = await Promise.all(
        batch.map((departure, planner) => this.planners[planner].plan([origin], [destination], date, departure))
      );

      for (const journeys of found) {
        results.push(...journeys);
      }

      if (this.applyFilters(results).length >= maxResults) {
        break;
      }
    }

    return this.applyFilters(results);
  }

  /**
   * Every time a journey could leave the origin at, in order.
   *
   * A journey does not have to start on a vehicle at the origin, it can walk somewhere else and
   * board there, so the times trips leave the far end of a footpath count too, less the time the
   * walk takes.
   */
  private departureTimes(origin: StopID, date: Date, from: Time, until: Time): Time[] {
    const stop = this.network.stopIndex.get(origin);

    if (stop === undefined) {
      return [];
    }

    const { routes, transfers } = this.network.timetable;
    const offset = dayOffset(routes.calendar, getDateNumber(date));

    if (offset === NOT_COVERED) {
      return [];
    }

    const times = new Set<Time>();

    this.collectDepartures(times, stop, 0, offset, from, until);

    for (let i = transfers.offsets[stop]; i < transfers.offsets[stop + 1]; i++) {
      this.collectDepartures(times, transfers.destination[i], transfers.duration[i], offset, from, until);
    }

    return [...times].sort((a, b) => a - b);
  }

  /**
   * Add the times a journey could leave the origin to catch a trip departing the given stop, which
   * is the trip's departure less the time it takes to walk there.
   */
  private collectDepartures(
    times: Set<Time>,
    stop: number,
    walk: Time,
    offset: number,
    from: Time,
    until: Time
  ): void {
    const { routes, routesByStop } = this.network.timetable;
    const { stopOffsets, stopTimesBase, tripOffsets, departures, calendar } = routes;

    for (let i = routesByStop.offsets[stop]; i < routesByStop.offsets[stop + 1]; i++) {
      const route = routesByStop.route[i];
      const position = routesByStop.position[i];
      const stopsInRoute = stopOffsets[route + 1] - stopOffsets[route];
      const numTrips = tripOffsets[route + 1] - tripOffsets[route];

      for (let t = 0; t < numTrips; t++) {
        const trip = tripOffsets[route] + t;

        if ((calendar.runs[offset + (trip >> 3)] & (1 << (trip & 7))) === 0) {
          continue;
        }

        const departure = departures[stopTimesBase[route] + t * stopsInRoute + position] - walk;

        if (departure >= from && departure < until) {
          times.add(departure);
        }
      }
    }
  }

  private applyFilters(journeys: Journey[]): Journey[] {
    return this.filters.reduce((rs, filter) => filter.apply(rs), journeys);
  }

}
