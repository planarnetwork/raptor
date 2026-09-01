import type { Journey } from "../Journey.js";

/**
 * Filter a number journeys
 */
export interface JourneyFilter {
  apply(journeys: Journey[]): Journey[];
}
