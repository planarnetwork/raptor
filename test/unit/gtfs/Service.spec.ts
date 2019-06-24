import * as chai from "chai";
import { allDays } from "../util";
import { Service } from "../../../src/gtfs/Service";

describe("Service", () => {

  it("checks the start date", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20180930, 1);

    chai.expect(result).to.equal(false);
  });

  it("checks the end date", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20181016, 1);

    chai.expect(result).to.equal(false);
  });

  it("checks dates within range", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20181010, 1);

    chai.expect(result).to.equal(true);
  });

  it("checks the day of the week", () => {
    const days = Object.assign({}, allDays, { 1: false });
    const service = new Service(
      20181001,
      20991231,
      days,
      {}
    );
    const result = service.runsOn(20181016, 1);

    chai.expect(result).to.equal(false);
  });

  it("checks include days", () => {
    const service = new Service(
      20991231,
      20991231,
      allDays,
      { 20181022: true }
    );

    const result = service.runsOn(20181022, 1);

    chai.expect(result).to.equal(true);
  });

  it("checks exclude days", () => {
    const service = new Service(
      20181001,
      20991231,
      allDays,
      { 20181022: false }
    );

    const result = service.runsOn(20181022, 1);

    chai.expect(result).to.equal(false);
  });

});
