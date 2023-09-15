import { StopID, StopTime, Time, TimetableLeg, Transfer, Trip } from "../../src/gtfs/GTFS";
import { Journey } from "../../src/results/Journey";
import { Service } from "../../src/gtfs/Service";

export const allDays = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };

export const services = {
  "1": new Service(
    20180101,
    20991231,
    allDays,
    {}
  ),
  "2": new Service(
    20190101,
    20991231,
    allDays,
    {}
  )
};

let tripId = 0;

export function t(...stopTimes: StopTime[]): Trip {
  return {
    tripId: "trip" + tripId++,
    stopTimes: stopTimes,
    serviceId: "1",
    service: services["1"]
  };
}

export function st(stop: StopID, arrivalTime: Time | null, departureTime: Time | null): StopTime {
  return {
    stop: stop,
    arrivalTime: arrivalTime || departureTime!,
    departureTime: departureTime || arrivalTime!,
    dropOff: arrivalTime !== null,
    pickUp: departureTime !== null
  };
}

const defaultTrip = { tripId: "1", serviceId: "1", stopTimes: [], service: services["1"] };

export function j(...legStopTimes: (StopTime[] | Transfer)[]): Journey {
  return {
    departureTime: getDepartureTime(legStopTimes),
    arrivalTime: getArrivalTime(legStopTimes),
    legs: legStopTimes.map(stopTimes => isTransfer(stopTimes) ? stopTimes : ({
      stopTimes,
      origin: stopTimes[0].stop,
      destination: stopTimes[stopTimes.length - 1].stop,
      trip: defaultTrip
    }))
  };
}

function getDepartureTime(legs: (StopTime[] | Transfer)[]): Time {
  let transferDuration = 0;

  for (const leg of legs) {
    if (isTransfer(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg[0].departureTime - transferDuration;
    }
  }

  return 0;
}

function getArrivalTime(legs: (StopTime[] | Transfer)[]): Time {
  let transferDuration = 0;

  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i];

    if (isTransfer(leg)) {
      transferDuration += leg.duration;
    }
    else {
      return leg[leg.length - 1].arrivalTime + transferDuration;
    }
  }

  return 0;
}

export function isTransfer(connection: StopTime[] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}

export function tf(origin: StopID, destination: StopID, duration: Time): Transfer {
  return { origin, destination, duration, startTime: 0, endTime: Number.MAX_SAFE_INTEGER };
}

export function setDefaultTrip(results: Journey[]) {
  for (const trip of results) {
    for (const leg of trip.legs as TimetableLeg[]) {
      if (leg.trip) {
        leg.trip = defaultTrip;
      }
    }
  }
}
