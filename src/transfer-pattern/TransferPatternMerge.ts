import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import * as zlib from "node:zlib";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import type { Writable } from "node:stream";
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

    let total = 0;

    for (const bucket of buckets) {
      const patterns = await this.patternsIn(bucket);

      total += patterns.length;

      for (const line of frontCode(patterns)) {
        await this.write(compressed, line);
      }
    }

    compressed.end();
    await written;

    for (const bucket of buckets) {
      await fs.promises.rm(this.bucketFile(bucket), { force: true });
    }

    return { patterns: total, bytes: (await fs.promises.stat(output)).size };
  }

  /**
   * Deal every line into the file for the station it starts from, and return those stations in
   * order, which is the order their patterns belong in
   */
  private async deal(inputs: string[]): Promise<string[]> {
    const files = new Map<string, fs.WriteStream>();

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

        let file = files.get(bucket);

        if (file === undefined) {
          file = fs.createWriteStream(this.bucketFile(bucket));
          files.set(bucket, file);
        }

        await this.write(file, line);
      }
    }

    await Promise.all([...files.values()].map(file =>
      new Promise<void>(resolve => file.end(resolve))
    ));

    return [...files.keys()].sort();
  }

  /**
   * The distinct patterns dealt into a bucket, in the order they are written in.
   *
   * They are collected into a set as the file is read, since the same pattern is found once from
   * each end of the journey and there is nothing to be done with the second copy.
   */
  private async patternsIn(bucket: string): Promise<string[]> {
    const patterns = new Set<string>();
    const lines = readline.createInterface({
      input: fs.createReadStream(this.bucketFile(bucket)),
      crlfDelay: Number.POSITIVE_INFINITY
    });

    for await (const line of lines) {
      if (line !== "") {
        patterns.add(line);
      }
    }

    return [...patterns].sort();
  }

  /**
   * Write a line, waiting only where the stream has fallen far enough behind to say so
   */
  private async write(stream: Writable, line: string): Promise<void> {
    if (!stream.write(`${line}\n`)) {
      await once(stream, "drain");
    }
  }

  private bucketFile(bucket: string): string {
    return path.join(this.workDir, `patterns-${bucket.charCodeAt(0)}.txt`);
  }

}

export interface MergedPatterns {
  /** How many distinct patterns the file holds */
  patterns: number;
  /** How large it is once compressed */
  bytes: number;
}
