import { describe, it, expect } from "vitest";
import {
  checkCodeWidths, frontCode, patternLines, readPatterns
} from "../../../src/transfer-pattern/PatternFormat.js";
import type { TransferPatternIndex } from "../../../src/transfer-pattern/results/StringResults.js";

function lines(patterns: TransferPatternIndex): string[] {
  return [...patternLines(patterns)];
}

async function roundTrip(paths: string[][]): Promise<string[][]> {
  const sorted = paths.map(path => path.join("")).sort();
  const out: string[][] = [];

  for await (const path of readPatterns([...frontCode(sorted)])) {
    out.push(path);
  }

  return out;
}

describe("PatternFile", () => {

  it("writes a pattern as the stations it calls at", () => {
    expect(lines({ NRWLST: new Set(["", "CBG", "CBG,BFR"]) }))
      .toEqual(["NRWLST", "NRWCBGLST", "NRWCBGBFRLST"]);
  });

  it("takes the leading stations a line shares with the one before it", () => {
    const sorted = ["NRWCBG", "NRWCBGAAP", "NRWCBGBFR", "NRWCBGBFRHNHPNE", "NRWCBGBFRHNHSYH"];

    expect([...frontCode(sorted)]).toEqual(["0NRWCBG", "2AAP", "2BFR", "3HNHPNE", "4SYH"]);
  });

  it("reads back what it wrote", async () => {
    const paths = [
      ["NRW", "CBG"],
      ["NRW", "CBG", "AAP"],
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"],
      ["NRW", "CBG", "BFR", "NWD", "PNW", "PNE"],
      ["NRW", "IPS"],
      ["YRK", "LDS", "MAN"]
    ];

    expect(await roundTrip(paths)).toEqual(paths.map(p => p.join("")).sort().map(p => p.match(/.{3}/g)));
  });

  it("keeps a pattern that a longer one runs through", async () => {
    // NRW to BFR is a pattern of its own as well as the start of a longer one, and a tree would
    // need a marker to say so where a line does not
    const paths = [["NRW", "CBG", "BFR"], ["NRW", "CBG", "BFR", "HNH", "PNE"]];

    expect(await roundTrip(paths)).toEqual([
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"]
    ]);
  });

  it("handles a pattern that shares nothing with the one before it", async () => {
    expect(await roundTrip([["AAA", "BBB"], ["CCC", "DDD"]])).toEqual([["AAA", "BBB"], ["CCC", "DDD"]]);
  });

  it("handles more shared stations than there are digits", async () => {
    const long = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "KKK"];

    expect(await roundTrip([long, [...long, "LLL"]])).toEqual([long, [...long, "LLL"]]);
  });

  it("rejects a station code of the wrong width", () => {
    expect(() => checkCodeWidths(["NRW", "LST"])).not.toThrow();
    expect(() => checkCodeWidths(["NRW", "PADDINGTON"])).toThrow(/3 character station codes/);
  });

});
