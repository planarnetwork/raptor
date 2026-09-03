import type { ConnectionIndex } from "../../raptor/Connection.js";
import type { StopID } from "../../gtfs/GTFS.js";
import type { Network } from "../../network/Network.js";

/**
 * Create the results factory
 */
export type TransferPatternResultsFactory<T> = () => TransferPatternResults<T>;

/**
 * Transfer pattern results
 */
export interface TransferPatternResults<T> {

  add(kConnections: ConnectionIndex, network: Network): void;

  finalize(): T;

}

/**
 * A list of stops representing a journeys path
 */
export type Path = StopID[];
