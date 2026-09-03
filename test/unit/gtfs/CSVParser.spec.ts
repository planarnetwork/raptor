import { describe, it, expect } from "vitest";
import { CSVParser, type Row } from "../../../src/gtfs/CSVParser.js";

/**
 * Parse a document in one go, copying each row out as it arrives.
 */
function parse(text: string, columns: string[]): Row[] {
  const rows: Row[] = [];
  const parser = new CSVParser(columns, row => rows.push({ ...row }));

  parser.write(text);
  parser.end();

  return rows;
}

/**
 * Parse the same document one character at a time, which puts a chunk boundary between every pair
 * of characters in it.
 */
function parseByCharacter(text: string, columns: string[]): Row[] {
  const rows: Row[] = [];
  const parser = new CSVParser(columns, row => rows.push({ ...row }));

  for (const character of text) {
    parser.write(character);
  }

  parser.end();

  return rows;
}

describe("CSVParser", () => {

  it("reads rows keyed by the header", () => {
    const rows = parse("a,b\n1,2\n3,4\n", ["a", "b"]);

    expect(2).toBe(rows.length);
    expect("1").toBe(rows[0].a);
    expect("2").toBe(rows[0].b);
    expect("3").toBe(rows[1].a);
    expect("4").toBe(rows[1].b);
  });

  it("only takes the columns it was asked for", () => {
    const rows = parse("a,b,c\n1,2,3\n", ["b"]);

    expect(1).toBe(rows.length);
    expect("2").toBe(rows[0].b);
    expect(false).toBe(Object.hasOwn(rows[0], "a"));
    expect(false).toBe(Object.hasOwn(rows[0], "c"));
  });

  it("leaves a column the file does not have undefined", () => {
    const rows = parse("a\n1\n", ["a", "missing"]);

    expect(undefined).toBe(rows[0].missing);
  });

  it("reports an empty field as undefined rather than an empty string", () => {
    const rows = parse("a,b,c\n1,,3\n", ["a", "b", "c"]);

    expect(undefined).toBe(rows[0].b);
    expect("1").toBe(rows[0].a);
    expect("3").toBe(rows[0].c);
  });

  it("leaves the columns a short row does not reach undefined", () => {
    const rows = parse("a,b,c\n1,2\n", ["a", "b", "c"]);

    expect("1").toBe(rows[0].a);
    expect("2").toBe(rows[0].b);
    expect(undefined).toBe(rows[0].c);
  });

  it("does not carry a value over from the previous row", () => {
    const rows = parse("a,b\n1,2\n3\n", ["a", "b"]);

    expect("2").toBe(rows[0].b);
    expect(undefined).toBe(rows[1].b);
  });

  it("drops the extra fields of a row longer than the header", () => {
    const rows = parse("a,b\n1,2,3,4\n", ["a", "b"]);

    expect(1).toBe(rows.length);
    expect("1").toBe(rows[0].a);
    expect("2").toBe(rows[0].b);
  });

  it("reads a trailing empty field", () => {
    const rows = parse("a,b\n1,\n", ["a", "b"]);

    expect("1").toBe(rows[0].a);
    expect(undefined).toBe(rows[0].b);
  });

  it("reads a final row the file did not terminate", () => {
    const rows = parse("a,b\n1,2", ["a", "b"]);

    expect(1).toBe(rows.length);
    expect("2").toBe(rows[0].b);
  });

  it("does not report a row for the newline at the end of the file", () => {
    expect(1).toBe(parse("a\n1\n", ["a"]).length);
  });

  it("skips blank lines", () => {
    const rows = parse("a\n1\n\n2\n", ["a"]);

    expect(2).toBe(rows.length);
    expect("1").toBe(rows[0].a);
    expect("2").toBe(rows[1].a);
  });

  it("handles CRLF line endings", () => {
    const rows = parse("a,b\r\n1,2\r\n", ["a", "b"]);

    expect("1").toBe(rows[0].a);
    expect("2").toBe(rows[0].b);
  });

  it("rejects bare carriage return line endings rather than misreading them", () => {
    expect(() => parse("a,b\r1,2\r", ["a", "b"])).toThrow(/carriage return/);
  });

  it("strips a byte order mark from the first column name", () => {
    const rows = parse("﻿a,b\n1,2\n", ["a", "b"]);

    expect("1").toBe(rows[0].a);
  });

  it("reads a quoted field containing a comma", () => {
    const rows = parse("a,b\n\"one,two\",3\n", ["a", "b"]);

    expect("one,two").toBe(rows[0].a);
    expect("3").toBe(rows[0].b);
  });

  it("reads a doubled quote inside a quoted field as one quote", () => {
    const rows = parse("a,b\n\"say \"\"hi\"\"\",3\n", ["a", "b"]);

    expect("say \"hi\"").toBe(rows[0].a);
    expect("3").toBe(rows[0].b);
  });

  it("reads a quoted field containing a newline", () => {
    const rows = parse("a,b\n\"one\ntwo\",3\n", ["a", "b"]);

    expect(1).toBe(rows.length);
    expect("one\ntwo").toBe(rows[0].a);
    expect("3").toBe(rows[0].b);
  });

  it("reads a quoted field in the last column", () => {
    const rows = parse("a,b\n1,\"two,three\"\n", ["a", "b"]);

    expect("1").toBe(rows[0].a);
    expect("two,three").toBe(rows[0].b);
  });

  it("reads a quoted empty field as undefined", () => {
    const rows = parse("a,b\n\"\",2\n", ["a", "b"]);

    expect(undefined).toBe(rows[0].a);
    expect("2").toBe(rows[0].b);
  });

  it("reads a quoted header column name", () => {
    const rows = parse("\"a\",b\n1,2\n", ["a", "b"]);

    expect("1").toBe(rows[0].a);
  });

  it("reuses the row object between rows", () => {
    const seen: Row[] = [];
    const parser = new CSVParser(["a"], row => seen.push(row));

    parser.write("a\n1\n2\n");

    expect(2).toBe(seen.length);
    expect(true).toBe(seen[0] === seen[1]);
  });

  /**
   * The chunk boundary is where a streaming parser goes wrong, so rather than guessing which
   * boundaries matter this puts one between every pair of characters and expects the same rows.
   */
  it("gives the same rows however the document is split across chunks", () => {
    const documents = [
      "a,b\n1,2\n3,4\n",
      "a,b\n\"one,two\",3\n4,5\n",
      "a,b\n\"one\ntwo\",3\n",
      "a,b\n\"say \"\"hi\"\"\",3\n",
      "a,b,c\r\n1,,3\r\n4,5\r\n",
      "a,b\n1,2",
      "a\n1\n\n2\n"
    ];

    for (const document of documents) {
      expect(parse(document, ["a", "b", "c"])).toEqual(parseByCharacter(document, ["a", "b", "c"]));
    }
  });

});
