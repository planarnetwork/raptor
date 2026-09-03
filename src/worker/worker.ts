import { PlannerHost } from "./PlannerHost.js";
import type { PlannerRequest } from "./Protocol.js";

/**
 * The worker entry point: everything it does is in PlannerHost, this only wires it to the port.
 *
 * Load it with `new Worker(new URL("raptor-journey-planner/worker", import.meta.url), { type: "module" })`.
 * The Worker is constructed by the caller rather than here, because how a worker's url is resolved
 * is a question for whatever is bundling the application, and guessing at it would only ever be
 * right for one bundler.
 */
const host = new PlannerHost();
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PlannerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = event => {
  host
    .handle(event.data, progress => scope.postMessage(progress))
    .then(response => scope.postMessage(response));
};
