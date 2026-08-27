import type { Network } from "../raptor/Network";
import type { Journey } from "./Journey";
import type { Connection, ConnectionIndex, TransferIdx } from "../raptor/ScanResults";
import type { StopIdx } from "../raptor/Timetable";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory {

  getResults(kConnections: ConnectionIndex, destination: StopIdx, network: Network): Journey[];

}

/**
 * A leg taken on foot is recorded as an index into the network's transfers, a leg taken on a
 * vehicle as a tuple.
 */
export function isTransfer(connection: Connection | TransferIdx): connection is TransferIdx {
  return typeof connection === "number";
}
