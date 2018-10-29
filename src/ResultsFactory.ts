import {AnyLeg, Journey, Stop, StopTime, Transfer} from "./GTFS";

export class ResultsFactory {

  public getResults(kConnections: ConnectionIndex, destination: Stop): Journey[] {
    const results: Journey[] = [];

    for (const k of Object.keys(kConnections[destination])) {
      results.push({ legs: this.getJourneyLegs(kConnections, k, destination) });
    }

    return results;
  }

  private getJourneyLegs(kConnections: ConnectionIndex, k: string, finalDestination: Stop) {
    const legs: AnyLeg[] = [];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {
        legs.push(connection);

        destination = connection.origin;
      }
      else {
        const [tripStopTimes, start, end] = connection;
        const stopTimes = tripStopTimes.slice(start, end + 1);
        const origin = stopTimes[0].stop;

        legs.push({ stopTimes, origin, destination });

        destination = origin;
      }
    }

    return legs.reverse();
  }

}

export type ConnectionIndex = Record<Stop, Record<number, [StopTime[], number, number] | Transfer>>;

function isTransfer(connection: [StopTime[], number, number] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}