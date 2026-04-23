import type { StopID, Transfer } from "../gtfs/GTFS";
import type { Journey } from "./Journey";
import type { Connection, ConnectionIndex } from "../raptor/ScanResults";

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
