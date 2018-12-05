import {Stop, Transfer} from "../gtfs/GTFS";
import {Connection, ConnectionIndex} from "../raptor/RaptorAlgorithm";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory<T> {

  getResults(kConnections: ConnectionIndex, destination: Stop): T[];

}

/**
 * Type check for a kConnection connection
 */
export function isTransfer(connection: Connection | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}
