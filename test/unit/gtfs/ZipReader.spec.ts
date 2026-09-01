import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readZip, type ZipEntry } from "../../../src/gtfs/ZipReader.js";

function zip(files: Record<string, string>): Uint8Array {
  const contents: Record<string, Uint8Array> = {};

  for (const [name, text] of Object.entries(files)) {
    contents[name] = strToU8(text);
  }

  return zipSync(contents);
}

async function* whole(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes;
}

/** Where the central directory starts, being everything after the entries themselves */
function centralDirectoryAt(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02) {
      return i;
    }
  }

  throw new Error("no central directory in the test fixture");
}

/** Puts a chunk boundary between every pair of bytes in the zip */
async function* byByte(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  for (let i = 0; i < bytes.length; i++) {
    yield bytes.subarray(i, i + 1);
  }
}

/** Read every entry, returning the text of each */
async function readAll(
  bytes: Uint8Array,
  chunks: (bytes: Uint8Array) => AsyncIterable<Uint8Array> = whole
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  await readZip(chunks(bytes), entry => {
    files[entry.name] = "";

    return text => { files[entry.name] += text; };
  });

  return files;
}

describe("readZip", () => {

  it("reads the text of each entry", async () => {
    const files = await readAll(zip({ "a.txt": "one", "b.txt": "two" }));

    expect("one").toBe(files["a.txt"]);
    expect("two").toBe(files["b.txt"]);
  });

  it("offers the entries in the order the zip stores them", async () => {
    const names: string[] = [];

    await readZip(whole(zip({ "a.txt": "1", "b.txt": "2", "c.txt": "3" })), entry => {
      names.push(entry.name);

      return () => undefined;
    });

    expect(["a.txt", "b.txt", "c.txt"]).toEqual(names);
  });

  it("never reads an entry that was declined", async () => {
    const read: string[] = [];

    await readZip(whole(zip({ "wanted.txt": "yes", "unwanted.txt": "no" })), entry => {
      if (entry.name === "unwanted.txt") {
        return undefined;
      }

      return text => { read.push(text); };
    });

    expect(["yes"]).toEqual(read);
  });

  it("tells the sink when an entry has finished", async () => {
    const finals: boolean[] = [];

    await readZip(whole(zip({ "a.txt": "one" })), () => (_text, final) => { finals.push(final); });

    expect(true).toBe(finals[finals.length - 1]);
  });

  it("declares the uncompressed size of an entry before reading it", async () => {
    const entries: ZipEntry[] = [];
    const text = "a".repeat(1000);

    await readZip(whole(zip({ "a.txt": text })), entry => {
      entries.push(entry);

      return () => undefined;
    });

    expect(1000).toBe(entries[0].originalSize);
  });

  /**
   * A zip arriving over the network is delivered in whatever chunks the network chose, so the
   * reader has to give the same answer however it is cut up.
   */
  it("gives the same text however the zip is split across chunks", async () => {
    const files = { "a.txt": "one", "b.txt": "two", "c.txt": "three" };
    const bytes = zip(files);

    expect(await readAll(bytes, whole)).toEqual(await readAll(bytes, byByte));
  });

  it("holds over a multi byte character split across two chunks", async () => {
    // long enough that the inflater emits it in more than one piece
    const text = "é€😀".repeat(20000);
    const files = await readAll(zip({ "a.txt": text }), byByte);

    expect(text).toBe(files["a.txt"]);
  });

  it("does not leak decoder state from one entry into the next", async () => {
    const files = await readAll(zip({ "a.txt": "é".repeat(5000), "b.txt": "plain" }), byByte);

    expect("plain").toBe(files["b.txt"]);
  });

  it("reports how much of the zip has been read", async () => {
    const bytes = zip({ "a.txt": "one" });
    const reported: number[] = [];

    await readZip(byByte(bytes), () => () => undefined, { onBytes: read => reported.push(read) });

    expect(bytes.length).toBe(reported[reported.length - 1]);
  });

  it("reports how much of an entry has been decompressed", async () => {
    const text = "a".repeat(50000);
    let last = 0;

    await readZip(whole(zip({ "a.txt": text })), () => () => undefined, {
      onEntryBytes: (_entry, read) => { last = read; }
    });

    expect(50000).toBe(last);
  });

  it("rejects rather than returning half a file when the zip is truncated", async () => {
    // content that does not compress away to nothing, so cutting it really does cut the data
    let text = "";

    for (let i = 0; i < 40000; i++) {
      text += `${i},${(i * 2654435761) % 1000000},x\n`;
    }

    const bytes = zip({ "a.txt": text });

    await expect(readAll(bytes.subarray(0, bytes.length >> 1))).rejects.toThrow(/invalid zip data/);
  });

  /**
   * Reading forwards means the central directory at the end of the zip is never consulted, so a
   * zip missing it still reads. Worth knowing rather than assuming it would be caught.
   */
  it("reads a zip whose central directory is missing", async () => {
    const bytes = zip({ "a.txt": "one" });
    const files = await readAll(bytes.subarray(0, centralDirectoryAt(bytes)));

    expect("one").toBe(files["a.txt"]);
  });

  it("rejects when the sink throws", async () => {
    const failing = readZip(whole(zip({ "a.txt": "one" })), () => () => {
      throw new Error("no thanks");
    });

    await expect(failing).rejects.toThrow(/no thanks/);
  });

});
