
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
  trip: Trip;
}

export interface Transfer extends Leg {
  duration: Duration;
  startTime: Time;
  endTime: Time;
}

export type AnyLeg = Transfer | TimetableLeg;

export interface Journey {
  legs: AnyLeg[];
}

export type TripID = string;

export type ServiceID = string;

export interface Trip {
  tripId: TripID;
  stopTimes: StopTime[];
  serviceId: ServiceID;
}

export type DateNumber = number;

export type DateIndex = Record<DateNumber, boolean>;

// Sunday = 0, Monday = 1... don't blame me, blame JavaScript .getDay
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Calendar {
  serviceId: ServiceID;
  startDate: DateNumber;
  endDate: DateNumber;
  days: Record<DayOfWeek, boolean>;
  exclude: DateIndex;
  include: DateIndex;
}
