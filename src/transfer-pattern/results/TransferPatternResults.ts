import { ConnectionIndex } from "../../raptor/RaptorAlgorithm";

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
