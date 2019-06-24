import { StopID, Time, Transfer, Trip } from "../gtfs/GTFS";

export class ScanResults {
  private k = 0;

  constructor(
    private readonly bestArrivals: Arrivals,
    private readonly kArrivals: ArrivalsByNumChanges,
    private readonly kConnections: ConnectionIndex
  ) {}

  public addRound(): void {
    this.kArrivals[++this.k] = {};
  }

  public previousArrival(stopPi: StopID): Time {
    return this.kArrivals[this.k - 1][stopPi];
  }

  public setTrip(trip: Trip, startIndex: number, endIndex: number, interchange: number): void {
    const time = trip.stopTimes[endIndex].arrivalTime + interchange;
    const stopPi = trip.stopTimes[endIndex].stop;

    this.kArrivals[this.k][stopPi] = time;
    this.bestArrivals[stopPi] = time;
    this.kConnections[stopPi][this.k] = [trip, startIndex, endIndex];
  }

  public setTransfer(transfer: Transfer, time: Time): void {
    const stopPi = transfer.destination;

    this.kArrivals[this.k][stopPi] = time;
    this.bestArrivals[stopPi] = time;
    this.kConnections[stopPi][this.k] = transfer;
  }

  public bestArrival(stopPi: StopID): Time {
    return this.bestArrivals[stopPi];
  }

  public getMarkedStops() {
    return Object.keys(this.kArrivals[this.k]);
  }

  public finalize(): [ConnectionIndex, Arrivals] {
    return [this.kConnections, this.bestArrivals];
  }
}

export type Arrivals = Record<StopID, Time>;
export type ArrivalsByNumChanges = Record<number, Arrivals>;
export type Connection = [Trip, number, number];
export type ConnectionIndex = Record<StopID, Record<number, Connection | Transfer>>;
