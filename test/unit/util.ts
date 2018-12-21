import {Journey, Stop, StopTime, Time, Transfer, Trip} from "../../src/gtfs/GTFS";

let tripId = 0;

export function t(...stopTimes: StopTime[]): Trip {
  return {
    tripId: "trip" + tripId++,
    stopTimes: stopTimes,
    serviceId: "1"
  };
}

export function st(stop: Stop, arrivalTime: Time | null, departureTime: Time | null): StopTime {
  return {
    stop: stop,
    arrivalTime: arrivalTime || departureTime!,
    departureTime: departureTime || arrivalTime!,
    dropOff: arrivalTime !== null,
    pickUp: departureTime !== null
  };
}

const defaultTrip = { tripId: "1", serviceId: "1", stopTimes: [] };

export function j(...legStopTimes: (StopTime[] | Transfer)[]): Journey {
  return {
    legs: legStopTimes.map(stopTimes => isTransfer(stopTimes) ? stopTimes : ({
      stopTimes,
      origin: stopTimes[0].stop,
      destination: stopTimes[stopTimes.length - 1].stop,
      trip: defaultTrip
    }))
  };
}

export function isTransfer(connection: StopTime[] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}

export function tf(origin: Stop, destination: Stop, duration: Time): Transfer {
  return { origin, destination, duration, startTime: 0, endTime: Number.MAX_SAFE_INTEGER };
}

export function setDefaultTrip(results: Journey[]) {
  for (const trip of results) {
    for (const leg of trip.legs as any[]) {
      if (leg.trip) {
        leg.trip = defaultTrip;
      }
    }
  }
}

export const allDays = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };

export const calendars = {
  "1": {
    serviceId: "1",
    startDate: 20180101,
    endDate: 20991231,
    days: allDays,
    include: {},
    exclude: {}
  }
};
