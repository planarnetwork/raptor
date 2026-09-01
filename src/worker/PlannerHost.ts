import type { Journey, TimetableLeg } from "../results/Journey.js";
import type { Network } from "../network/Network.js";
import type { Stop } from "../gtfs/GTFS.js";
import type { GTFSFeed } from "../gtfs/GTFSLoader.js";
import { createNetwork } from "../network/Network.js";
import { GroupStationDepartAfterQuery } from "../query/GroupStationDepartAfterQuery.js";
import { JourneyFactory } from "../results/JourneyFactory.js";
import { loadGTFS, loadGTFSFromUrl } from "../gtfs/GTFSLoader.js";
import type { LoadProgress } from "../gtfs/Progress.js";
import type { PlainJourney, PlainLeg, PlannerEvent, PlannerRequest, PlannerResponse } from "./Protocol.js";

/**
 * Answers planning requests against a feed it holds on to.
 *
 * The feed and the network stay on this side. A national feed is hundreds of megabytes of objects
 * and copying it to the other side of a worker boundary would cost more than building it did, so
 * only the journeys asked for are sent back, and those are a few thousand objects at most.
 *
 * This knows nothing about workers, so it can be driven directly by a test or by a caller that
 * would rather not have one.
 */
export class PlannerHost {

  private feed: GTFSFeed | undefined;
  private network: Network | undefined;
  private readonly resultsFactory = new JourneyFactory();

  public async handle(request: PlannerRequest, post: (event: PlannerEvent) => void): Promise<PlannerResponse> {
    try {
      switch (request.type) {
        case "load": return await this.load(request, post);
        case "plan": return this.plan(request);
        case "stops": return this.stops(request);
      }
    }
    catch (e) {
      // an error does not survive being posted, so it is reduced to its message here
      return { id: request.id, type: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }

  private async load(
    request: Extract<PlannerRequest, { type: "load" }>,
    post: (event: PlannerEvent) => void
  ): Promise<PlannerResponse> {
    const options = { onProgress: (progress: LoadProgress) => post({ type: "progress", progress }) };
    const location = request.feed;

    this.feed = isUrl(location)
      ? await loadGTFSFromUrl(location.url, options)
      : await loadGTFS(location, options);

    this.network = createNetwork(this.feed, request.date === undefined ? undefined : new Date(request.date));

    return { id: request.id, type: "loaded", stops: this.network.stopIds.length, trips: this.network.trips.length };
  }

  private plan(request: Extract<PlannerRequest, { type: "plan" }>): PlannerResponse {
    const network = this.loaded();
    const query = new GroupStationDepartAfterQuery(network, this.resultsFactory);
    const journeys = query.plan(request.origins, request.destinations, new Date(request.date), request.time);

    return { id: request.id, type: "planned", journeys: journeys.map(toPlainJourney) };
  }

  private stops(request: Extract<PlannerRequest, { type: "stops" }>): PlannerResponse {
    this.loaded();

    return { id: request.id, type: "stops", stops: Object.values((this.feed as GTFSFeed).stops) as Stop[] };
  }

  private loaded(): Network {
    if (this.network === undefined) {
      throw new Error("No feed has been loaded yet, send a load request before planning");
    }

    return this.network;
  }

}

function isUrl(location: unknown): location is { url: string } {
  return typeof (location as { url?: unknown })?.url === "string";
}

/**
 * Strip the parts of a journey that cannot survive the crossing.
 */
function toPlainJourney(journey: Journey): PlainJourney {
  return {
    legs: journey.legs.map(toPlainLeg),
    departureTime: journey.departureTime,
    arrivalTime: journey.arrivalTime
  };
}

function toPlainLeg(leg: PlainLeg | TimetableLeg): PlainLeg {
  const timetableLeg = leg as TimetableLeg;

  if (timetableLeg.trip === undefined) {
    return leg as PlainLeg;
  }

  return {
    origin: timetableLeg.origin,
    destination: timetableLeg.destination,
    stopTimes: timetableLeg.stopTimes,
    trip: {
      tripId: timetableLeg.trip.tripId,
      serviceId: timetableLeg.trip.serviceId,
      stopTimes: timetableLeg.trip.stopTimes
    }
  };
}
