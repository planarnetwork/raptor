/**
 * A parsed row. A field the file leaves empty, or does not have a column for, is undefined rather
 * than "", which is what the processors reading these rows expect: an empty pickup_type means the
 * call can be boarded, and an empty stop_code means the station is named by its stop_id.
 */
export type Row = Record<string, string | undefined>;

const QUOTE = 34;
const CARRIAGE_RETURN = 13;

/**
 * Reads CSV a chunk at a time, which is what a file arriving from a zip inside a download gives us.
 *
 * Two things here are for the benefit of the one file that dominates a feed. stop_times.txt is 200MB
 * and three million rows in the GB rail feed, so the parser only slices out the columns it was asked
 * for, and it hands the same row object back every time rather than allocating three million of them.
 */
export class CSVParser {

  /** Text not yet parsed, being the tail of a row that was split across chunks */
  private buffer = "";
  /** Offset the memoised quote position was searched from */
  private quoteBase = 0;
  /** Offset of the next quote at or after quoteBase, -1 for none, undefined for not yet searched */
  private quoteAt: number | undefined;
  /** For each column of the file, the row key to store it under, or undefined to skip it */
  private keys: (string | undefined)[] | undefined;
  private readonly row: Row = {};

  /**
   * @param columns the fields to take. A column the file does not have stays undefined, and a column
   *                the file has that is not wanted is never sliced out of the chunk.
   * @param onRow called once per row. The row object is REUSED between rows, so copy out what you
   *              need rather than keeping a reference to it.
   */
  constructor(
    private readonly columns: readonly string[],
    private readonly onRow: (row: Row) => void
  ) {
    // fix the shape up front so every row shares one hidden class
    for (const column of columns) {
      this.row[column] = undefined;
    }
  }

  /**
   * Take the next chunk of the file. A row split across two calls is held over until the rest of it
   * arrives, and a quoted field may span both.
   */
  public write(text: string): void {
    this.buffer = this.buffer.length === 0 ? text : this.buffer + text;
    this.quoteAt = undefined;
    this.quoteBase = 0;

    let start = 0;

    for (let end = this.rowEnd(start); end !== -1; end = this.rowEnd(start)) {
      this.emit(start, end);
      start = end + 1;
    }

    if (start > 0) {
      this.buffer = this.buffer.slice(start);
    }
  }

  /**
   * Parse a final row that the file did not terminate with a newline. Call once, at end of file.
   */
  public end(): void {
    if (this.buffer.length > 0) {
      this.emit(0, this.buffer.length);
      this.buffer = "";
    }
  }

  /**
   * The offset of the newline ending the row that starts at `start`, or -1 if the buffer does not
   * hold the whole of it yet.
   *
   * A newline inside a quoted field does not end the row, so a row containing a quote has to be
   * scanned past its closing quote. Most rows contain none and cost a single indexOf.
   */
  private rowEnd(start: number): number {
    let from = start;

    while (true) {
      const newline = this.buffer.indexOf("\n", from);

      if (newline === -1) {
        return -1;
      }

      const quote = this.nextQuote(from);

      if (quote === -1 || quote > newline) {
        return newline;
      }

      const closing = this.closingQuote(quote + 1, this.buffer.length);

      if (closing === -1) {
        return -1; // the field is still open, the rest of it is in a later chunk
      }

      from = closing + 1;
    }
  }

  /**
   * The offset of the next quote at or after `from`, or -1 if the buffer holds none.
   *
   * Memoised because indexOf has no end bound, so on a file with no quoted fields at all every
   * lookup scans to the end of the buffer to say so. stop_times.txt is 200MB and three million
   * rows of exactly that, and searching it per row rather than per chunk costs seconds.
   */
  private nextQuote(from: number): number {
    const stale = this.quoteAt === undefined
      || from < this.quoteBase
      || (this.quoteAt !== -1 && this.quoteAt < from);

    if (stale) {
      this.quoteBase = from;
      this.quoteAt = this.buffer.indexOf("\"", from);
    }

    return this.quoteAt as number;
  }

  /**
   * The offset of the quote closing a field whose content starts at `from`, or -1 if it is not
   * within `stop`. A doubled quote is an escaped one rather than the end of the field.
   */
  private closingQuote(from: number, stop: number): number {
    for (let at = from; at < stop; ) {
      const closing = this.buffer.indexOf("\"", at);

      if (closing === -1 || closing >= stop) {
        return -1;
      }
      if (this.buffer.charCodeAt(closing + 1) !== QUOTE) {
        return closing;
      }

      at = closing + 2;
    }

    return -1;
  }

  /**
   * Turn the text between `start` and `end` into a row, or into the header if it is the first one.
   */
  private emit(start: number, end: number): void {
    // a row ending \r\n keeps the \r out of its last field
    const stop = end > start && this.buffer.charCodeAt(end - 1) === CARRIAGE_RETURN ? end - 1 : end;

    if (stop <= start) {
      return; // a blank line is not a row, unlike csv-parser which reports it as an empty one
    }

    if (this.keys === undefined) {
      this.readHeader(start, stop);
    }
    else {
      this.readRow(start, stop);
    }
  }

  private readHeader(start: number, stop: number): void {
    const header: string[] = [];

    this.split(start, stop, (from, to, quoted) => header.push(this.field(from, to, quoted) ?? ""));

    // TextDecoder strips the BOM, but a caller writing text we did not decode may not have
    if (header.length > 0 && header[0].charCodeAt(0) === 0xfeff) {
      header[0] = header[0].slice(1);
    }

    if (header.some(name => name.includes("\r"))) {
      throw new Error("CSV with bare carriage return line endings is not supported, use \\n or \\r\\n");
    }

    this.keys = header.map(name => this.columns.includes(name) ? name : undefined);
  }

  private readRow(start: number, stop: number): void {
    const keys = this.keys as (string | undefined)[];

    // a row shorter than the header leaves the columns it does not reach undefined
    for (const column of this.columns) {
      this.row[column] = undefined;
    }

    let column = 0;

    this.split(start, stop, (from, to, quoted) => {
      // a row longer than the header has nowhere to put its extra fields, so they are dropped
      const key = column < keys.length ? keys[column] : undefined;

      column++;

      if (key !== undefined) {
        this.row[key] = this.field(from, to, quoted);
      }
    });

    this.onRow(this.row);
  }

  /**
   * Call `onField` with the bounds of each field of the row, and whether it was quoted. Reporting
   * bounds rather than strings is what lets a caller skip a column without paying to slice it.
   */
  private split(start: number, stop: number, onField: (from: number, to: number, quoted: boolean) => void): void {
    let from = start;

    while (from <= stop) {
      if (this.buffer.charCodeAt(from) === QUOTE) {
        const closing = this.closingQuote(from + 1, stop);
        const to = closing === -1 ? stop : closing;

        onField(from + 1, to, true);

        // anything between the closing quote and the comma is not valid CSV, so it is dropped
        const comma = this.buffer.indexOf(",", to + 1);

        from = comma === -1 || comma >= stop ? stop + 1 : comma + 1;
      }
      else {
        const comma = this.buffer.indexOf(",", from);
        const to = comma === -1 || comma >= stop ? stop : comma;

        onField(from, to, false);

        from = to + 1;
      }
    }
  }

  private field(from: number, to: number, quoted: boolean): string | undefined {
    if (to <= from) {
      return undefined;
    }

    const value = this.buffer.slice(from, to);

    return quoted && value.includes("\"\"") ? value.replace(/""/g, "\"") : value;
  }

}
