import type { TimetableLeg } from "../results/Journey.js";
import type {
  AgencyIndex, GTFSSource, LoadProgress, RouteIndex, Stop, StopID, Time, Transfer, Trip
} from "@gb-transit/gtfs-loader";

/**
 * A trip as it crosses the worker boundary: the trip, less its Service.
 *
 * Posting a message copies the data of an object but not the class it belongs to, so a Service
 * would arrive with its fields and without its runsOn, which is worse than not sending it: the
 * caller cannot see that it is broken. Whether a trip runs on a date is settled inside the worker
 * before the journey is returned anyway.
 *
 * Everything else a trip carries is data and crosses as it is, so this says what is taken away
 * rather than listing what is kept: a field the loader adds to Trip arrives on the other side
 * without this file being touched, and reads there under the name it has here.
 */
export type PlainTrip = Omit<Trip, "service">;

export type PlainLeg = Transfer | (Omit<TimetableLeg, "trip"> & { trip: PlainTrip });

export interface PlainJourney {
  legs: PlainLeg[];
  departureTime: Time;
  arrivalTime: Time;
}

/**
 * Where to load a feed from. A url is fetched by the worker itself, so the bytes never cross the
 * boundary; anything else is posted to it.
 */
export type FeedLocation = GTFSSource | { url: string };

export type PlannerRequest =
  | { id: number; type: "load"; feed: FeedLocation; date?: number }
  | { id: number; type: "plan"; origins: StopID[]; destinations: StopID[]; date: number; time: Time }
  | { id: number; type: "stops" };

/**
 * A request before the client gives it an id. Omit has to be spread over the members of the union
 * by hand, since applied to the union as a whole it would keep only the keys they all share.
 */
export type PlannerCommand = PlannerRequest extends infer R
  ? R extends PlannerRequest ? Omit<R, "id"> : never
  : never;

export type PlannerResponse =
  | { id: number; type: "loaded"; stops: number; trips: number; routes: RouteIndex; agencies: AgencyIndex }
  | { id: number; type: "planned"; journeys: PlainJourney[] }
  | { id: number; type: "stops"; stops: Stop[] }
  | { id: number; type: "error"; message: string };

/**
 * Sent while a request is being handled rather than in answer to it, so it carries no id.
 */
export type PlannerEvent = { type: "progress"; progress: LoadProgress };

export type PlannerMessage = PlannerResponse | PlannerEvent;

export function isEvent(message: PlannerMessage): message is PlannerEvent {
  return (message as PlannerResponse).id === undefined;
}
