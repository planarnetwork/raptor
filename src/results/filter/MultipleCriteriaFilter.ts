import { Journey } from "../Journey";
import { JourneyFilter } from "./JourneyFilter";

/**
 * Returns true if b arrives before or at the same time as a
 */
export const earliestArrival = (a, b) => b.arrivalTime <= a.arrivalTime;

/**
 * Returns true if b has the same or fewer changes than a
 */
export const leastChanges = (a, b) => b.legs.length <= a.legs.length;

/**
 * Filters journeys based on a number of configurable criteria
 */
export class MultipleCriteriaFilter implements JourneyFilter {

  constructor(
    private readonly criteria: FilterCriteria[] = [earliestArrival, leastChanges]
  ) {}

  /**
   * Sort the journeys and then apply the criteria
   */
  public apply(journeys: Journey[]): Journey[] {
    journeys.sort(this.sort);

    return journeys.filter((a, i, js) => this.compare(a, i, js));
  }

  /**
   * Sort by departure time ascending and arrival time descending as a tie breaker
   */
  private sort(a: Journey, b: Journey): number {
    return a.departureTime !== b.departureTime ? a.departureTime - b.departureTime : b.arrivalTime - a.arrivalTime;
  }

  /**
   * Keeps the journey as long as there is no subsequent journey that is better in every regard.
   */
  private compare(journeyA: Journey, index: number, journeys: Journey[]): boolean {
    for (let j = index + 1; j < journeys.length; j++) {
      const journeyB = journeys[j];

      if (this.criteria.every(criteria => criteria(journeyA, journeyB))) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Function that compares two journeys and returns true if the second is better than the first
 */
export type FilterCriteria = (a: Journey, b: Journey) => boolean;
