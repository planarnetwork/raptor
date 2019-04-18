import { ConnectionIndex } from "../../raptor/RaptorAlgorithm";
import { StopID } from "../../gtfs/GTFS";

/**
 * Create the results factory
 */
export type TransferPatternResultsFactory<T> = () => TransferPatternResults<T>;

/**
 * Transfer pattern results
 */
export interface TransferPatternResults<T> {

  add(kConnections: ConnectionIndex): void;

  finalize(): T;

}

/**
 * A list of stops representing a journeys path
 */
export type Path = StopID[];
