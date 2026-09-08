import type { AgencyIndex, GTFSSource, LoadProgress, RouteIndex, Stop, StopID, Time } from "@gb-transit/gtfs-loader";
import {
  type FeedLocation,
  isEvent,
  type PlainJourney,
  type PlannerMessage,
  type PlannerCommand,
  type PlannerResponse
} from "./Protocol.js";

export interface ClientLoadOptions {
  onProgress?: (progress: LoadProgress) => void;
  /** Plan only for this date, which makes the timetable smaller and the queries faster */
  date?: Date;
}

/**
 * Plans journeys in a worker, so that loading a feed and scanning it do not block the page.
 *
 * The worker keeps the feed and the timetable and only the journeys asked for are sent back. Those
 * are copies: a leg's trip is not the same object the worker holds, and it carries no Service, so
 * it cannot be used to ask whether the trip runs on some other date. Ask the worker instead.
 *
 * The Worker is constructed by the caller, because resolving a worker's url is a question for
 * whatever is bundling the application:
 *
 * ```js
 * const worker = new Worker(new URL("raptor-journey-planner/worker", import.meta.url), { type: "module" });
 * const planner = new PlannerClient(worker);
 * ```
 */
export class PlannerClient {

  private readonly pending = new Map<number, (response: PlannerResponse) => void>();
  private onProgress: ((progress: LoadProgress) => void) | undefined;
  private nextId = 1;

  constructor(private readonly worker: Worker) {
    this.worker.onmessage = (event: MessageEvent<PlannerMessage>) => this.receive(event.data);
  }

  /**
   * Load a feed, from a url the worker fetches itself or from bytes sent to it.
   */
  public async load(feed: GTFSSource | { url: string }, options: ClientLoadOptions = {}): Promise<LoadedFeed> {
    this.onProgress = options.onProgress;

    try {
      const response = await this.send({
        type: "load",
        feed: feed as FeedLocation,
        date: options.date?.getTime()
      });

      if (response.type !== "loaded") {
        throw new Error(`Unexpected reply to load: ${response.type}`);
      }

      return {
        stops: response.stops,
        trips: response.trips,
        routes: response.routes,
        agencies: response.agencies
      };
    }
    finally {
      this.onProgress = undefined;
    }
  }

  /**
   * Plan between a set of origins and a set of destinations, departing after the given time.
   */
  public async plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<PlainJourney[]> {
    const response = await this.send({ type: "plan", origins, destinations, date: date.getTime(), time });

    if (response.type !== "planned") {
      throw new Error(`Unexpected reply to plan: ${response.type}`);
    }

    return response.journeys;
  }

  /**
   * The stops of the loaded feed, for naming places in a user interface.
   */
  public async stops(): Promise<Stop[]> {
    const response = await this.send({ type: "stops" });

    if (response.type !== "stops") {
      throw new Error(`Unexpected reply to stops: ${response.type}`);
    }

    return response.stops;
  }

  /**
   * Stop the worker. Anything still waiting on it is rejected rather than left hanging.
   */
  public terminate(): void {
    for (const [id, resolve] of this.pending) {
      resolve({ id, type: "error", message: "The planner was terminated" });
    }

    this.pending.clear();
    this.worker.terminate();
  }

  private send(request: PlannerCommand): Promise<PlannerResponse> {
    const id = this.nextId++;

    return new Promise<PlannerResponse>((resolve, reject) => {
      this.pending.set(id, response => {
        if (response.type === "error") {
          reject(new Error(response.message));
        }
        else {
          resolve(response);
        }
      });

      this.worker.postMessage({ ...request, id });
    });
  }

  private receive(message: PlannerMessage): void {
    if (isEvent(message)) {
      this.onProgress?.(message.progress);

      return;
    }

    const pending = this.pending.get(message.id);

    this.pending.delete(message.id);
    pending?.(message);
  }

}

/**
 * What the worker has, after loading a feed.
 *
 * The routes and agencies come with it because a journey's legs do not carry them: a leg names the
 * route its trip runs on, and these are what turn that id into a route and an operator. They are
 * few enough - the GB feed has under a hundred routes and 41 agencies - to send whole, once, which
 * is cheaper than copying an operator's name onto every leg of every journey planned afterwards.
 *
 * ```js
 * const feed = await planner.load({ url });
 * const route = feed.routes[leg.trip.routeId];
 * const operator = feed.agencies[route.agencyId].name;
 * ```
 */
export interface LoadedFeed {
  /** Stations the timetable plans between */
  stops: number;
  trips: number;
  /** Routes of the feed by route id, which is what a leg's trip names */
  routes: RouteIndex;
  /** Agencies of the feed by agency id, which is what a route names */
  agencies: AgencyIndex;
}
