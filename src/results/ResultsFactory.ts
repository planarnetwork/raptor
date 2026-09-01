import type { Network } from "../network/Network.js";
import type { ConnectionIndex } from "../raptor/Connection.js";
import type { StopIdx } from "../network/Timetable.js";
import type { Journey } from "./Journey.js";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory {

  getResults(kConnections: ConnectionIndex, destination: StopIdx, network: Network): Journey[];

}
