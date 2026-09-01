import type { DateNumber, Interchange, StopIndex, TransfersByOrigin, Trip } from "./GTFS.js";
import { COLUMNS, entityTypeOf } from "./EntityType.js";
import { CSVParser } from "./CSVParser.js";
import { FeedBuilder } from "./FeedBuilder.js";
import { type LoadOptions, ProgressReporter } from "./Progress.js";
import { type GTFSSource, sizeOf, toChunks } from "./Source.js";
import { readZip } from "./ZipReader.js";

/**
 * Returns the contents of a GTFS zip.
 *
 * The zip is read as it arrives rather than after it has all been collected, so the source can be
 * anything the environment can give bytes from: a file stream in node, a fetch response in a
 * browser, or the bytes themselves.
 *
 * Stops are returned as the feed gives them. Resolving them to the stations the algorithm plans
 * between is done when the timetable is created.
 */
export async function loadGTFS(source: GTFSSource, options: LoadOptions = {}): Promise<GTFSFeed> {
  const builder = new FeedBuilder();
  const progress = new ProgressReporter(options, sizeOf(source));
  let found = 0;

  await readZip(
    toChunks(source),
    entry => {
      const type = entityTypeOf(entry.name);

      if (type === undefined) {
        return undefined;
      }

      found++;

      const parser = progress.wanted
        ? new CSVParser(COLUMNS[type], row => { progress.rows++; builder.add(type, row); })
        : new CSVParser(COLUMNS[type], row => builder.add(type, row));

      return (text, final) => {
        parser.write(text);

        if (final) {
          parser.end();
        }
      };
    },
    {
      onBytes: bytes => progress.onBytes(bytes),
      onEntryBytes: (entry, bytes) => progress.onEntryBytes(entry, bytes)
    }
  );

  // an unzipper reading forwards finds no entries in something that is not a zip and says nothing
  // about it, so a feed that turned out to be an error page would otherwise load as an empty one
  if (found === 0) {
    throw new Error(
      "No GTFS files found. The source has to be a zip containing stops.txt, trips.txt, "
      + "stop_times.txt and the rest; if it came from a url, check that the url really returns a "
      + "feed rather than an error page."
    );
  }

  progress.onBuilding();

  return builder.build();
}

/**
 * Fetches a GTFS zip and loads it, parsing it as it downloads.
 *
 * The feed has to be readable by the page, which for a browser means the host either serves it from
 * the same origin or sends an Access-Control-Allow-Origin header. Most GTFS publishers do neither,
 * so expect to proxy or to host the feed yourself.
 */
export async function loadGTFSFromUrl(url: string | URL, options: FetchOptions = {}): Promise<GTFSFeed> {
  const request = options.fetch ?? globalThis.fetch;
  const href = url.toString();

  if (typeof request !== "function") {
    throw new Error("No fetch available, pass one in options.fetch");
  }

  let response: Response;

  try {
    response = await request(href, { signal: options.signal, headers: options.headers });
  }
  catch (cause) {
    // an abort is the caller's own doing and is reported as itself
    if (cause instanceof Error && cause.name === "AbortError") {
      throw cause;
    }

    throw new GTFSFetchError(href, undefined, { cause });
  }

  if (!response.ok) {
    throw new GTFSFetchError(href, response.status);
  }

  return loadGTFS(response, options);
}

export interface FetchOptions extends LoadOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** The fetch to use, for an environment that does not have one or for a test that fakes it */
  fetch?: typeof fetch;
}

/**
 * A feed that could not be fetched.
 */
export class GTFSFetchError extends Error {

  constructor(
    public readonly url: string,
    public readonly status?: number,
    options?: { cause?: unknown }
  ) {
    super(describe(url, status, options?.cause), options);

    this.name = "GTFSFetchError";
  }

}

/**
 * A browser refuses a cross origin fetch by rejecting with a TypeError that says nothing, on
 * purpose, so the likely reason is given here rather than left to be guessed at.
 */
function describe(url: string, status: number | undefined, cause: unknown): string {
  if (status !== undefined) {
    return `Could not fetch ${url}, the server responded ${status}`;
  }

  const reason = cause instanceof Error ? cause.message : String(cause);

  return `Could not fetch ${url}. In a browser this is nearly always CORS: a feed on another origin `
    + `is only readable if the server sends an Access-Control-Allow-Origin header, and most GTFS `
    + `hosts do not. Serve the feed from your own origin, or put a proxy in front of it that adds `
    + `the header. Asking for it with mode "no-cors" does not help, because the response is then `
    + `opaque and has no body to read. The underlying error was: ${reason}`;
}

/**
 * Contents of the GTFS zip file
 */
export interface GTFSFeed {
  trips: Trip[];
  transfers: TransfersByOrigin;
  interchange: Interchange;
  stops: StopIndex;
  /** feed_info.txt, which a feed does not have to provide */
  feedInfo?: FeedInfo;
}

/**
 * The period the feed covers, and the version it was published as
 */
export interface FeedInfo {
  startDate?: DateNumber;
  endDate?: DateNumber;
  version?: string;
}
