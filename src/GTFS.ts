
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

export enum RouteType {
  Tram = 0,
  Subway = 1,
  Rail = 2,
  Bus = 3,
  Ferry = 4,
  Cable  = 5,
  Gondola = 6,
  Funicular = 7
}

export type TripID = string;

export interface Trip {
  tripId: TripID;
  stopTimes: StopTime[];
}
