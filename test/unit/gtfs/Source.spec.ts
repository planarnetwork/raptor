import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { sizeOf, toChunks, type GTFSSource } from "../../../src/gtfs/Source.js";

const BYTES = new Uint8Array([1, 2, 3, 4, 5]);

async function collect(source: GTFSSource): Promise<number[]> {
  const bytes: number[] = [];

  for await (const chunk of toChunks(source)) {
    bytes.push(...chunk);
  }

  return bytes;
}

describe("toChunks", () => {

  it("reads a Uint8Array", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect(BYTES));
  });

  it("reads a view onto part of a buffer without reading the rest of it", async () => {
    const view = new Uint8Array(BYTES.buffer, 1, 3);

    expect([2, 3, 4]).toEqual(await collect(view));
  });

  it("reads an ArrayBuffer", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect(BYTES.buffer as ArrayBuffer));
  });

  it("reads a Blob", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect(new Blob([BYTES])));
  });

  it("reads a Response", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect(new Response(BYTES)));
  });

  it("reads a ReadableStream", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect(new Response(BYTES).body as ReadableStream<Uint8Array>));
  });

  /**
   * This is what fs.createReadStream gives, which is how the loader has always been called.
   */
  it("reads a Node readable stream", async () => {
    const stream = Readable.from([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);

    expect([1, 2, 3, 4, 5]).toEqual(await collect(stream));
  });

  it("reads a Node stream that gives Buffers", async () => {
    const stream = Readable.from([Buffer.from([1, 2]), Buffer.from([3, 4, 5])]);

    expect([1, 2, 3, 4, 5]).toEqual(await collect(stream));
  });

  it("reads a stream opened with an encoding, which gives strings", async () => {
    const stream = Readable.from(["ab", "c"]);

    expect([97, 98, 99]).toEqual(await collect(stream as unknown as GTFSSource));
  });

  it("reads a plain iterable of chunks", async () => {
    expect([1, 2, 3, 4, 5]).toEqual(await collect([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]));
  });

  it("says so rather than failing obscurely when given something it cannot read", () => {
    expect(() => toChunks(42 as unknown as GTFSSource)).toThrow(/Cannot read a GTFS feed/);
  });

});

describe("sizeOf", () => {

  it("knows the size of bytes", () => {
    expect(5).toBe(sizeOf(BYTES));
    expect(5).toBe(sizeOf(BYTES.buffer as ArrayBuffer));
  });

  it("knows the size of a Blob", () => {
    expect(5).toBe(sizeOf(new Blob([BYTES])));
  });

  it("takes the size of a Response from its content length", () => {
    const response = new Response(BYTES, { headers: { "content-length": "5" } });

    expect(5).toBe(sizeOf(response));
  });

  it("does not guess the size of a stream", () => {
    expect(undefined).toBe(sizeOf(Readable.from([BYTES])));
  });

});
