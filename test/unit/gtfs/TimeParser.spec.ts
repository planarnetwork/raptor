import { describe, it, expect } from "vitest";
import {TimeParser} from "../../../src/gtfs/TimeParser";

describe("TimeParser", () => {

  it("turns a time string into seconds from midnight", () => {
    const parser = new TimeParser();

    expect(0).toBe(parser.getTime("00:00:00"));
    expect(10).toBe(parser.getTime("00:00:10"));
    expect(130).toBe(parser.getTime("00:02:10"));
    expect(10930).toBe(parser.getTime("03:02:10"));
  });

});
