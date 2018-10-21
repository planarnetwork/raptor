
export type Stop = string;

export type Time = number;

export type Duration = number;

export interface StopTime {
  stop: Stop;
  arrivalTime: Time;
  departureTime: Time;
  pickUp: boolean;
  dropOff: boolean;
}

export interface Leg {
  origin: Stop;
  destination: Stop;
}

export interface TimetableLeg extends Leg {
  stopTimes: StopTime[];
}

export interface Transfer extends Leg {
  duration: Duration;
}

export type AnyLeg = Transfer | TimetableLeg;

export interface Journey {
  legs: AnyLeg[];
}

export type TripID = string;

export interface Trip {
  tripId: TripID;
  stopTimes: StopTime[];
}
