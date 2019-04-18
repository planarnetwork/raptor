import {StopID, Transfer} from "../gtfs/GTFS";
import {Connection, ConnectionIndex} from "../raptor/RaptorAlgorithm";
import { Journey } from "./Journey";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory {

  getResults(kConnections: ConnectionIndex, destination: StopID): Journey[];

}

/**
 * Type check for a kConnection connection
 */
export function isTransfer(connection: Connection | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}
