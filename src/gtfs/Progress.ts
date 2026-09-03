import type { ZipEntry } from "./ZipReader.js";

/**
 * How far through loading a feed we are.
 *
 * A national feed is tens of megabytes compressed and hundreds of millions of rows uncompressed, so
 * loading one is a wait worth showing. bytesTotal is the size of the zip, not of its contents, and
 * is only known when the source knows it: a download without a content-length does not.
 */
export interface LoadProgress {
  phase: "reading" | "building";
  /** Bytes of the zip read so far */
  bytesRead: number;
  /** Bytes of the zip in total, where the source knows */
  bytesTotal?: number;
  /** The file being read */
  entry?: string;
  /** Uncompressed bytes of that file read so far */
  entryBytesRead: number;
  /** Uncompressed size of that file, where the zip declares it up front */
  entryBytesTotal?: number;
  /** Rows handed to the feed so far, across every file */
  rows: number;
}

export interface LoadOptions {
  onProgress?: (progress: LoadProgress) => void;
  /** Milliseconds between reports. Defaults to 100. */
  progressInterval?: number;
}

const DEFAULT_INTERVAL = 100;

/**
 * Counts what has been read and reports it now and then.
 *
 * Rows are counted rather than reported, because a feed has millions of them and asking the clock
 * on each one would cost more than the parsing does.
 */
export class ProgressReporter {

  private readonly onProgress: ((progress: LoadProgress) => void) | undefined;
  private readonly interval: number;
  private readonly bytesTotal: number | undefined;

  private lastReport = Number.NEGATIVE_INFINITY;
  private bytesRead = 0;
  private entryName: string | undefined;
  private entryBytesRead = 0;
  private entryBytesTotal: number | undefined;

  public rows = 0;

  constructor(options: LoadOptions, bytesTotal?: number) {
    this.onProgress = options.onProgress;
    this.interval = options.progressInterval ?? DEFAULT_INTERVAL;
    this.bytesTotal = bytesTotal;
  }

  /** Whether anything is listening, so the caller can skip the counting entirely */
  public get wanted(): boolean {
    return this.onProgress !== undefined;
  }

  public onBytes(bytesRead: number): void {
    this.bytesRead = bytesRead;
    this.report("reading");
  }

  public onEntryBytes(entry: ZipEntry, bytesRead: number): void {
    if (entry.name !== this.entryName) {
      this.entryName = entry.name;
      this.entryBytesTotal = entry.originalSize;
    }

    this.entryBytesRead = bytesRead;
    this.report("reading");
  }

  /** The last of it, reported whatever the clock says */
  public onBuilding(): void {
    this.report("building", true);
  }

  private report(phase: LoadProgress["phase"], always = false): void {
    if (this.onProgress === undefined) {
      return;
    }

    const now = performance.now();

    if (!always && now - this.lastReport < this.interval) {
      return;
    }

    this.lastReport = now;

    this.onProgress({
      phase,
      bytesRead: this.bytesRead,
      bytesTotal: this.bytesTotal,
      entry: this.entryName,
      entryBytesRead: this.entryBytesRead,
      entryBytesTotal: this.entryBytesTotal,
      rows: this.rows
    });
  }

}
