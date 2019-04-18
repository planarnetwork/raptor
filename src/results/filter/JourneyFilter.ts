import { Journey } from "../Journey";

/**
 * Filter a number journeys
 */
export interface JourneyFilter {
  apply(journeys: Journey[]): Journey[];
}
