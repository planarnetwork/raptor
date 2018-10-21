import * as chai from "chai";
import {Journey, Leg, Stop, StopTime, Time, Transfer, Trip} from "../src/GTFS";
import {Raptor} from "../src/Raptor";

describe("Raptor", () => {

  it("finds journeys with direct connections", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "C", 20181016);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ])
    ]);
  });

  it("finds journeys with a single connection", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1000),
        st("B", 1030, 1035),
        st("E", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "E", 20181016);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
      ], [
        st("B", 1030, 1035),
        st("E", 1100, null)
      ])
    ]);
  });

  it("does not return journeys that cannot be made", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1035, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1000),
        st("B", 1030, 1030),
        st("E", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "E", 20181016);

    chai.expect(result).to.deep.equal([]);
  });

  it("returns the fastest and the least changes", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("B", null, 1030),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "C", 20181016);

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
    ], [
      st("B", null, 1030),
      st("C", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct,
      change
    ]);
  });

  it("chooses the fastest journey where the number of journeys is the same", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("D", 1230, 1230),
        st("E", 1300, null)
      ),
      t(
        st("A", null, 1100),
        st("F", 1130, 1130),
        st("G", 1200, null)
      ),
      t(
        st("G", null, 1200),
        st("H", 1230, 1230),
        st("E", 1255, null)
      ),
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "E", 20181016);

    const fastest = j([
      st("A", null, 1100),
      st("F", 1130, 1130),
      st("G", 1200, null)
    ], [
      st("G", null, 1200),
      st("H", 1230, 1230),
      st("E", 1255, null)
    ]);

    chai.expect(result).to.deep.equal([
      fastest
    ]);
  });

  it("chooses an arbitrary journey when they are the same", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("D", 1230, 1230),
        st("E", 1300, null)
      ),
      t(
        st("A", null, 1100),
        st("F", 1130, 1130),
        st("G", 1200, null)
      ),
      t(
        st("G", null, 1200),
        st("H", 1230, 1230),
        st("E", 1300, null)
      ),
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "E", 20181016);

    const journey1 = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1100, null)
    ], [
      st("C", null, 1200),
      st("D", 1230, 1230),
      st("E", 1300, null)
    ]);

    chai.expect(result).to.deep.equal([
      journey1
    ]);
  });

  it("chooses the correct change point", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      t(
        st("A", null, 1030),
        st("C", 1200, null)
      ),
      t(
        st("C", null, 1000),
        st("B", 1030, 1030),
        st("E", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("B", 1230, 1230),
        st("E", 1300, null)
      ),
    ];

    const raptor = new Raptor(trips, {});
    const result = raptor.plan("A", "E", 20181016);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null)
    ], [
      st("B", 1030, 1030),
      st("E", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("finds journeys with a transfer", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1200),
        st("E", 1300, null)
      )
    ];

    const transfers = {
      "C": [
        tf("C", "D", 10)
      ]
    };

    const raptor = new Raptor(trips, transfers);
    const result = raptor.plan("A", "E", 20181016);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ],
      tf("C", "D", 10)
      , [
        st("D", null, 1200),
        st("E", 1300, null)
      ])
    ]);
  });

});

let tripId = 0;

function t(...stopTimes: StopTime[]): Trip {
  return {
    tripId: "trip" + tripId++,
    stopTimes: stopTimes
  };
}

function st(stop: Stop, arrivalTime: Time | null, departureTime: Time | null): StopTime {
  return {
    stop: stop,
    arrivalTime: arrivalTime || departureTime!,
    departureTime: departureTime || arrivalTime!,
    dropOff: arrivalTime !== null,
    pickUp: departureTime !== null
  };
}

function j(...legStopTimes: (StopTime[] | Transfer)[]): Journey {
  return {
    legs: legStopTimes.map(stopTimes => isTransfer(stopTimes) ? stopTimes : ({
      stopTimes,
      origin: stopTimes[0].stop,
      destination: stopTimes[stopTimes.length - 1].stop
    }))
  };
}

function isTransfer(connection: StopTime[] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}

function tf(origin: Stop, destination: Stop, duration: Time): Transfer {
  return { origin, destination, duration };
}
