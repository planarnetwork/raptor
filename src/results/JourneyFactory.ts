import { StopID, Time, TimetableLeg } from "../gtfs/GTFS";
import { isTransfer, ResultsFactory } from "./ResultsFactory";
import { ConnectionIndex } from "../raptor/RaptorAlgorithm";
import { AnyLeg, Journey } from "./Journey";

/**
 * Extracts journeys from the kConnections index.
 */
export class JourneyFactory implements ResultsFactory {

  /**
   * Take the best result of each round for the given destination and turn it into a journey.
   */
  public getResults(kConnections: ConnectionIndex, destination: StopID): Journey[] {
    const results: Journey[] = [];

    for (const k of Object.keys(kConnections[destination] || {})) {
      const legs = this.getJourneyLegs(kConnections, k, destination);
      const departureTime = this.getDepartureTime(legs);
      const arrivalTime = this.getArrivalTime(legs);

      results.push({ legs, departureTime, arrivalTime });
    }

    return results;
  }

  /**
   * Iterate back through each connection and build up a series of legs to plan the journey
   */
  private getJourneyLegs(kConnections: ConnectionIndex, k: string, finalDestination: StopID): AnyLeg[] {
    const legs: AnyLeg[] = [];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {
        legs.push(connection);

        destination = connection.origin;
      } else {
        const [trip, start, end] = connection;
        const stopTimes = trip.stopTimes.slice(start, end + 1);
        const origin = stopTimes[0].stop;

        legs.push({stopTimes, origin, destination, trip});

        destination = origin;
      }
    }

    return legs.reverse();
  }

  private getDepartureTime(legs: AnyLeg[]): Time {
    let transferDuration = 0;

    for (const leg of legs) {
      if (!this.isTimetableLeg(leg)) {
        transferDuration += leg.duration;
      }
      else {
        return leg.stopTimes[0].departureTime - transferDuration;
      }
    }

    return 0;
  }

  private getArrivalTime(legs: AnyLeg[]): Time {
    let transferDuration = 0;

    for (let i = legs.length - 1; i >= 0; i--) {
      const leg = legs[i];

      if (!this.isTimetableLeg(leg)) {
        transferDuration += leg.duration;
      }
      else {
        return leg.stopTimes[leg.stopTimes.length - 1].arrivalTime + transferDuration;
      }
    }

    return 0;
  }

  private isTimetableLeg(connection: AnyLeg): connection is TimetableLeg {
    return (connection as TimetableLeg).stopTimes !== undefined;
  }
}
