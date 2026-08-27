import type { Network } from "../network/Network";
import type { ConnectionIndex } from "../raptor/Connection";
import type { StopIdx } from "../network/Timetable";
import type { Journey } from "./Journey";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory {

  getResults(kConnections: ConnectionIndex, destination: StopIdx, network: Network): Journey[];

}
