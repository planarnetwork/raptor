import * as chai from "chai";
import {Journey, Stop, StopTime, Time, Transfer, Trip} from "../../src/GTFS";
import {Raptor} from "../../src/Raptor";

describe("Raptor", () => {
  const allDays = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
  const calendars = [
    {
      serviceId: "1",
      startDate: 20180101,
      endDate: 20991231,
      days: allDays,
      include: {},
      exclude: {}
    }
  ];

  it("finds journeys with direct connections", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ])
    ]);
  });

  it("finds the earliest calendars", () => {
    const trips = [
      t(
        st("A", null, 1400),
        st("B", 1430, 1435),
        st("C", 1500, null)
      ),
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

    const raptor = new Raptor(trips, transfers, {}, calendars);
    const result = raptor.plan("A", "E", new Date("2018-10-16"));

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

  it("uses a transfer if it is faster", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1130),
        st("D", 1200, null)
      )
    ];

    const transfers = {
      "C": [
        tf("C", "D", 10)
      ]
    };

    const raptor = new Raptor(trips, transfers, {}, calendars);
    const result = raptor.plan("A", "D", new Date("2018-10-16"));

    const transfer = j(
      [
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ],
      tf("C", "D", 10)
    );

    chai.expect(result).to.deep.equal([
      transfer
    ]);
  });

  it("doesn't allow pick up from locations without pickup specified", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("E", null, 1000),
        st("B", 1030, null),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct
    ]);
  });

  it("doesn't allow drop off at non-drop off locations", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", null, 1030),
        st("C", 1200, null)
      ),
      t(
        st("E", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      )
    ];

    const raptor = new Raptor(trips, {}, {}, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

    const direct = j([
      st("A", null, 1000),
      st("B", null, 1030),
      st("C", 1200, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct
    ]);
  });

  it("applies interchange times", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("B", null, 1030),
        st("C", 1100, null)
      ),
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = { B: 10 };

    const raptor = new Raptor(trips, transfers, interchange, calendars);
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct,
      change
    ]);
  });

  it("applies interchange times to transfers", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      t(
        st("C", null, 1030),
        st("D", 1100, null)
      ),
      t(
        st("C", null, 1050),
        st("D", 1110, null)
      ),
      t(
        st("C", null, 1100),
        st("D", 1120, null)
      )
    ];

    const transfers = {
      "B": [
        tf("B", "C", 10)
      ]
    };

    const interchange = { B: 10, C: 10 };

    const raptor = new Raptor(trips, transfers, interchange, calendars);
    const result = raptor.plan("A", "D", new Date("2018-10-16"));

    const lastPossible = j(
      [
        st("A", null, 1000),
        st("B", 1030, null),
      ],
      tf("B", "C", 10),
      [
        st("C", null, 1100),
        st("D", 1120, null)
      ]
    );

    chai.expect(result).to.deep.equal([
      lastPossible
    ]);
  });

  it("omits calendars not running that day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = { serviceId: "2", startDate: 20181001, endDate: 20181015, days: allDays, include: {}, exclude: {}};

    const raptor = new Raptor(trips, transfers, interchange, calendars.concat(calendar));
    const result = raptor.plan("A", "C", new Date("2018-10-16"));

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("omits calendars not running that day of the week", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const days = Object.assign({}, allDays, { 1: false });
    const calendar = { serviceId: "2", startDate: 20181001, endDate: 20991231, days: days, include: {}, exclude: {} };

    const raptor = new Raptor(trips, transfers, interchange, calendars.concat(calendar));
    const result = raptor.plan("A", "C", new Date("2018-10-22"));

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("includes calendars with an include day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = {
      serviceId: "2",
      startDate: 20991231,
      endDate: 20991231,
      days: allDays,
      include: { 20181022: true },
      exclude: {}
    };

    const raptor = new Raptor(trips, transfers, interchange, calendars.concat(calendar));
    const result = raptor.plan("A", "C", new Date("2018-10-22"));

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1030),
      st("C", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("omits calendars with an exclude day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = {
      serviceId: "2",
      startDate: 20181001,
      endDate: 20991231,
      days: allDays,
      include: {},
      exclude: { 20181022: true }
    };

    const raptor = new Raptor(trips, transfers, interchange, calendars.concat(calendar));
    const result = raptor.plan("A", "C", new Date("2018-10-22"));

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

});

let tripId = 0;

function t(...stopTimes: StopTime[]): Trip {
  return {
    tripId: "trip" + tripId++,
    stopTimes: stopTimes,
    serviceId: "1"
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
