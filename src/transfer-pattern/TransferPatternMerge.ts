import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import * as zlib from "node:zlib";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { frontCode } from "./PatternFormat.js";

/**
 * How hard the finished file is compressed. Five is where brotli stops being free: it holds a few
 * hundred megabytes a second, where the levels above it manage single figures.
 */
const QUALITY = 5;

/**
 * Folds the files the workers wrote into one.
 *
 * The patterns have to be in order to be folded into a tree, and there are too many of them to
 * sort at once. They are dealt into a file per leading station first, which is a sort of the first
 * station and leaves each file small enough to sort on its own; reading those files back in order
 * then gives the whole run in order without ever holding all of it.
 *
 * The same pattern is found twice, once from each end of the journey, so sorting a file is also
 * where the duplicates go. That is the one thing the database it replaced was doing.
 */
export class TransferPatternMerge {

  constructor(
    private readonly workDir: string
  ) { }

  /**
   * Merge the given files into one, and return how many patterns it holds
   */
  public async merge(inputs: string[], output: string): Promise<MergedPatterns> {
    const buckets = await this.deal(inputs);
    const compressed = zlib.createBrotliCompress({
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: QUALITY }
    });
    const written = pipeline(compressed, fs.createWriteStream(output));

    let patterns = 0;

    for (const bucket of [...buckets.keys()].sort()) {
      const sorted = [...new Set(await this.read(buckets.get(bucket) as string))].sort();

      patterns += sorted.length;

      for (const line of frontCode(sorted)) {
        if (!compressed.write(`${line}\n`)) {
          await once(compressed, "drain");
        }
      }
    }

    compressed.end();
    await written;

    for (const bucket of buckets.values()) {
      await fs.promises.rm(bucket, { force: true });
    }

    return { patterns, bytes: (await fs.promises.stat(output)).size };
  }

  /**
   * Deal every line into a file named after the station it starts from
   */
  private async deal(inputs: string[]): Promise<Map<string, string>> {
    const buckets = new Map<string, string>();
    const streams = new Map<string, fs.WriteStream>();

    for (const input of inputs) {
      const lines = readline.createInterface({
        input: fs.createReadStream(input).pipe(zlib.createGunzip()),
        crlfDelay: Number.POSITIVE_INFINITY
      });

      for await (const line of lines) {
        if (line === "") {
          continue;
        }

        const bucket = line.slice(0, 1);

        let stream = streams.get(bucket);

        if (stream === undefined) {
          const file = path.join(this.workDir, `patterns-${bucket.charCodeAt(0)}.txt`);

          stream = fs.createWriteStream(file);
          streams.set(bucket, stream);
          buckets.set(bucket, file);
        }

        if (!stream.write(`${line}\n`)) {
          await once(stream, "drain");
        }
      }
    }

    await Promise.all([...streams.values()].map(stream =>
      new Promise<void>(resolve => stream.end(() => resolve()))
    ));

    return buckets;
  }

  private async read(file: string): Promise<string[]> {
    const lines: string[] = [];
    const input = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Number.POSITIVE_INFINITY
    });

    for await (const line of input) {
      if (line !== "") {
        lines.push(line);
      }
    }

    return lines;
  }

}

export interface MergedPatterns {
  patterns: number;
  bytes: number;
}
