import type { StopID, Time } from "@gb-transit/gtfs-loader";
import type { Journey } from "../results/Journey.js";
import type { JourneyFilter } from "../results/filter/JourneyFilter.js";
import type { AsyncPlanner } from "./AsyncPlanner.js";

/**
 * Spreads depart after queries over a pool of planners, sending each to the one with the least
 * work outstanding.
 *
 * This makes a server answering many queries faster. It does not make one query faster: a single
 * depart after query is one scan, and the only way to divide that is to split the routes of a
 * round between threads, which is a change to the algorithm and not to this layer.
 */
export class ParallelDepartAfterQuery {

  private readonly inFlight: number[];

  constructor(
    private readonly planners: AsyncPlanner[],
    private readonly filters: JourneyFilter[] = []
  ) {
    if (planners.length === 0) {
      throw new Error("A ParallelDepartAfterQuery needs at least one planner");
    }

    this.inFlight = planners.map(() => 0);
  }

  public plan(origin: StopID, destination: StopID, date: Date, time: Time): Promise<Journey[]> {
    return this.planGroup([origin], [destination], date, time);
  }

  /**
   * Plan between a set of origins and a set of destinations, as GroupStationDepartAfterQuery does
   */
  public async planGroup(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<Journey[]> {
    const planner = this.leastBusy();

    this.inFlight[planner]++;

    try {
      const journeys = await this.planners[planner].plan(origins, destinations, date, time);

      return this.filters.reduce((rs, filter) => filter.apply(rs), journeys);
    }
    finally {
      this.inFlight[planner]--;
    }
  }

  private leastBusy(): number {
    let planner = 0;

    for (let i = 1; i < this.inFlight.length; i++) {
      if (this.inFlight[i] < this.inFlight[planner]) {
        planner = i;
      }
    }

    return planner;
  }

}
