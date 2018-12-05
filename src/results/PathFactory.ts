import {Stop} from "../gtfs/GTFS";
import {ConnectionIndex, isTransfer, ResultsFactory} from "./ResultsFactory";

/**
 * Extracts paths from the kConnections index.
 */
export class PathFactory implements ResultsFactory<Path> {

  /**
   * Take the best result of each round for the given destination and turn it into a journey.
   */
  public getResults(kConnections: ConnectionIndex, destination: Stop): Path[] {
    const results: Path[] = [];

    for (const k of Object.keys(kConnections[destination])) {
      results.push(this.getPath(kConnections, k, destination));
    }

    return results;
  }

  /**
   * Iterator back through each connection and build up a series of legs to create the journey
   */
  private getPath(kConnections: ConnectionIndex, k: string, finalDestination: Stop): Path {
    const path: Path = [finalDestination];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {

        destination = connection.origin;
      } else {
        const [trip, start] = connection;
        const origin = trip.stopTimes[start].stop;

        destination = origin;
      }

      path.push(destination);
    }

    return path.reverse();
  }

}

export type Path = Stop[];
