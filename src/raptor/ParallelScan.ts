import type { Timetable } from "../network/Timetable.js";

/**
 * The state one parallel scan mutates, and the cells its threads coordinate through.
 *
 * The timetable itself is not here. createNetwork allocates it on SharedArrayBuffers, so posting
 * it to a worker shares it rather than copying it. These are the arrays a scan writes, which every
 * worker writes at once and so have to be set up explicitly.
 */
export interface ParallelScanState {
  /** The previous round's arrivals, only read during a round */
  prev: SharedArrayBuffer;
  /** This round's arrivals, written blindly by every worker and repaired at the barrier */
  cur: SharedArrayBuffer;
  /** The best arrival over every round so far, also written blindly */
  best: SharedArrayBuffer;
  /** The routes to scan this round, and the position to start each from, indexed by route */
  queueRoutes: SharedArrayBuffer;
  queuePositions: SharedArrayBuffer;
  /** One update log per worker, LOG_STRIDE ints per entry, with the counts alongside */
  logs: SharedArrayBuffer[];
  logCounts: SharedArrayBuffer;
  control: SharedArrayBuffer;
}

/** stop, arrival, route, trip, boarding point, alighting point */
export const LOG_STRIDE = 6;

/** Entries one worker can log in a round. A round cannot update a stop more often than it has routes */
export const LOG_CAPACITY = 1 << 19;

/** Bumped to open a round. Workers wait on it, so it is also what wakes them */
export const CTL_GENERATION = 0;
/** Counts the workers that have finished the round */
export const CTL_FINISHED = 1;
/** The next route in the queue to be taken, handed out with an atomic add */
export const CTL_NEXT_ROUTE = 2;
export const CTL_QUEUE_SIZE = 3;
export const CTL_COMMAND = 4;
/** Byte offset of the day being scanned in the calendar */
export const CTL_RUNS_OFFSET = 5;
export const CTL_LENGTH = 8;

export const CMD_SCAN = 0;
export const CMD_EXIT = 1;

export function createParallelScanState(
  timetable: Timetable,
  numWorkers: number
): ParallelScanState {
  const numStops = timetable.interchange.length;
  const numRoutes = timetable.routes.stopOffsets.length - 1;

  return {
    prev: new SharedArrayBuffer(numStops * 4),
    cur: new SharedArrayBuffer(numStops * 4),
    best: new SharedArrayBuffer(numStops * 4),
    queueRoutes: new SharedArrayBuffer(numRoutes * 4),
    queuePositions: new SharedArrayBuffer(numRoutes * 4),
    logs: Array.from({ length: numWorkers }, () => new SharedArrayBuffer(LOG_CAPACITY * LOG_STRIDE * 4)),
    logCounts: new SharedArrayBuffer(numWorkers * 4),
    control: new SharedArrayBuffer(CTL_LENGTH * 4)
  };
}

/**
 * What a worker is sent once, before any round. Everything after it goes through shared memory.
 */
export interface ParallelScanSetup {
  timetable: Timetable;
  state: ParallelScanState;
  worker: number;
  /** Routes taken off the queue at a time */
  grain: number;
}

/**
 * All a scan worker has to be. Both a node Worker and a browser Worker satisfy it, so the caller
 * can make whichever their environment needs.
 */
export interface ScanWorker {
  postMessage(message: unknown): void;
  terminate(): unknown;
}
