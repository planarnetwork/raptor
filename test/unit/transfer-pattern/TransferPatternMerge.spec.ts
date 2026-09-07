import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { TransferPatternMerge } from "../../../src/transfer-pattern/TransferPatternMerge.js";
import { readPatterns } from "../../../src/transfer-pattern/PatternFormat.js";

const made: string[] = [];

async function workDir(): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "merge-patterns-test-"));

  made.push(dir);

  return dir;
}

function part(dir: string, name: string, lines: string[]): string {
  const file = path.join(dir, name);

  fs.writeFileSync(file, zlib.gzipSync(`${lines.join("\n")}\n`));

  return file;
}

async function paths(output: string): Promise<string[][]> {
  const text = zlib.brotliDecompressSync(await fs.promises.readFile(output)).toString();

  const paths: string[][] = [];

  for await (const path of readPatterns(text.split("\n"))) {
    paths.push(path);
  }

  return paths;
}

afterEach(async () => {
  await Promise.all(made.splice(0).map(dir => fs.promises.rm(dir, { recursive: true, force: true })));
});

describe("TransferPatternMerge", () => {

  it("puts every pattern in order", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");
    const parts = [
      part(dir, "a.gz", ["NRWCBGLST", "NRWLST", "BHMNCLEDB"]),
      part(dir, "b.gz", ["BHMEDB", "NRWCBGBFRLST"])
    ];

    const { patterns } = await new TransferPatternMerge(dir).merge(parts, output);

    expect(patterns).toBe(5);
    expect(await paths(output)).toEqual([
      ["BHM", "EDB"],
      ["BHM", "NCL", "EDB"],
      ["NRW", "CBG", "BFR", "LST"],
      ["NRW", "CBG", "LST"],
      ["NRW", "LST"]
    ]);
  });

  it("keeps one copy of a pattern found from both ends", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");
    const parts = [
      part(dir, "a.gz", ["BHMNRW", "BHMEUSNRW"]),
      part(dir, "b.gz", ["BHMNRW", "BHMLSTNRW"])
    ];

    const { patterns } = await new TransferPatternMerge(dir).merge(parts, output);

    expect(patterns).toBe(3);
    expect(await paths(output)).toEqual([
      ["BHM", "EUS", "NRW"],
      ["BHM", "LST", "NRW"],
      ["BHM", "NRW"]
    ]);
  });

  it("clears up after itself", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");

    await new TransferPatternMerge(dir).merge([part(dir, "a.gz", ["NRWLST"])], output);

    expect(fs.readdirSync(dir).filter(f => f.startsWith("patterns-"))).toEqual([]);
  });

  it("writes an empty file for no patterns", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");

    const { patterns } = await new TransferPatternMerge(dir).merge([part(dir, "a.gz", [])], output);

    expect(patterns).toBe(0);
    expect(await paths(output)).toEqual([]);
  });

});
