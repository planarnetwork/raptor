import { describe, it, expect } from "vitest";
import { allDays } from "../util.js";
import { LinkedService, Service } from "../../../src/gtfs/Service.js";

// 20180101 is a Monday
const MONDAY = 20180101;
const TUESDAY = 20180102;
const noDays = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
const onlyOn = (dow: number) => ({ ...noDays, [dow]: true });

describe("Service", () => {

  it("checks the start date", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20180930, 1);

    expect(result).toBe(false);
  });

  it("checks the end date", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20181016, 1);

    expect(result).toBe(false);
  });

  it("checks dates within range", () => {
    const service = new Service(
      20181001,
      20181015,
      allDays,
      {}
    );

    const result = service.runsOn(20181010, 1);

    expect(result).toBe(true);
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

    expect(result).toBe(false);
  });

  it("checks include days", () => {
    const service = new Service(
      20991231,
      20991231,
      allDays,
      { 20181022: true }
    );

    const result = service.runsOn(20181022, 1);

    expect(result).toBe(true);
  });

  it("checks exclude days", () => {
    const service = new Service(
      20181001,
      20991231,
      allDays,
      { 20181022: false }
    );

    const result = service.runsOn(20181022, 1);

    expect(result).toBe(false);
  });

});

describe("Service.dayEarlier", () => {

  it("moves the days of the week back one", () => {
    const service = new Service(20180101, 20181231, onlyOn(2), {}).dayEarlier();

    expect(service.runsOn(MONDAY, 1)).toBe(true);
    expect(service.runsOn(TUESDAY, 2)).toBe(false);
  });

  it("moves the date range back one", () => {
    const service = new Service(20180102, 20180102, allDays, {}).dayEarlier();

    expect(service.runsOn(MONDAY, 1)).toBe(true);
    expect(service.runsOn(TUESDAY, 2)).toBe(false);
  });

  it("moves exception dates back one", () => {
    const service = new Service(20180101, 20181231, onlyOn(2), { 20180109: false }).dayEarlier();

    expect(service.runsOn(MONDAY, 1)).toBe(true);
    expect(service.runsOn(20180108, 1)).toBe(false);
  });

});

describe("LinkedService", () => {

  it("runs on the days both services do", () => {
    const service = new LinkedService(
      new Service(20180101, 20181231, allDays, {}),
      new Service(20180101, 20180101, allDays, {})
    );

    expect(service.runsOn(MONDAY, 1)).toBe(true);
    expect(service.runsOn(TUESDAY, 2)).toBe(false);
  });

});
