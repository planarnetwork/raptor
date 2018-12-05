import {Stop, Transfer, Trip} from "../gtfs/GTFS";

/**
 * Create results from the kConnections index
 */
export interface ResultsFactory<T> {

  getResults(kConnections: ConnectionIndex, destination: Stop): T[];

}

export type ConnectionIndex = Record<Stop, Record<number, [Trip, number, number] | Transfer>>;

export function isTransfer(connection: [Trip, number, number] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}
