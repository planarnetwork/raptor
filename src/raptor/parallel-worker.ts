import { parentPort } from "node:worker_threads";
import { runScanWorker } from "./ParallelScanWorker.js";
import type { ParallelScanSetup } from "./ParallelScan.js";

/**
 * The scan worker's entry point for node, which only wires the port to the scan.
 *
 * Load it with `new Worker(new URL("raptor-journey-planner/parallel-worker", import.meta.url))`.
 * The Worker is constructed by the caller rather than here, because how a worker's url is resolved
 * is a question for whatever is bundling the application.
 *
 * The setup arrives as the one and only message. Everything after it is shared memory, so this
 * thread blocks inside runScanWorker rather than returning to its event loop.
 */
parentPort?.once("message", (setup: ParallelScanSetup) => {
  runScanWorker(setup);
  parentPort?.close();
});
