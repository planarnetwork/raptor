import type { StopID } from "@gb-transit/gtfs-loader";
import type { TransferPatternIndex } from "./results/StringResults.js";

/**
 * A transfer pattern as the stations it calls at, from the first to the last.
 */
export type PatternPath = StopID[];

/**
 * Characters in a station code. Every code in a file is this wide, which is what lets a line be
 * read back by cutting it up rather than looking for separators.
 */
export const CODE_WIDTH = 3;

/**
 * The lines a set of patterns is written as, one per pattern, each the stations it calls at.
 *
 * A TransferPatternIndex already keys a pattern by its two end stations in order, and holds the
 * change points running the same way, so a line is the key opened out around them.
 *
 * That order is alphabetical, not the order anyone travelled in: the pattern from Norwich to
 * Liverpool Street is written LST first, and is the same line as the one from Liverpool Street to
 * Norwich read the other way. A journey either way changes at the same places in the same order,
 * so both are one line, and a reader looking for one direction has to look under the other.
 */
export function* patternLines(patterns: TransferPatternIndex): Generator<string> {
  for (const key in patterns) {
    const from = key.slice(0, CODE_WIDTH);
    const to = key.slice(CODE_WIDTH);

    for (const pattern of patterns[key]) {
      yield from + (pattern === "" ? "" : pattern.replaceAll(",", "")) + to;
    }
  }
}

/**
 * Rewrite sorted lines as the tree they describe.
 *
 * Sorting puts patterns sharing a leading run of stations next to each other, so a line only has
 * to say how many of them it takes from the line before and what follows. That is the same tree
 * written depth first, and it needs no marker for a pattern that another pattern runs through,
 * since every line is one pattern.
 *
 * The count is one character, `0` for none, so it stays readable while a pattern is shorter than
 * ten stations. Longer ones carry on up the character set rather than overflowing.
 */
export function* frontCode(sorted: Iterable<string>): Generator<string> {
  let previous = "";

  for (const line of sorted) {
    let shared = 0;

    while (
      (shared + 1) * CODE_WIDTH <= Math.min(line.length, previous.length) &&
      line.startsWith(previous.slice(0, (shared + 1) * CODE_WIDTH))
    ) {
      shared++;
    }

    yield String.fromCharCode(48 + shared) + line.slice(shared * CODE_WIDTH);
    previous = line;
  }
}

/**
 * Read back what frontCode wrote, as the stations of each pattern.
 *
 * It takes the lines a few at a time rather than all at once, since a national feed holds tens of
 * millions of them, which is why it will take a stream as readily as an array.
 */
export async function* readPatterns(
  lines: AsyncIterable<string> | Iterable<string>
): AsyncGenerator<PatternPath> {
  let previous: PatternPath = [];

  for await (const line of lines) {
    if (line === "") {
      continue;
    }

    const shared = line.charCodeAt(0) - 48;
    const path = previous.slice(0, shared);

    for (let at = 1; at < line.length; at += CODE_WIDTH) {
      path.push(line.slice(at, at + CODE_WIDTH));
    }

    yield path;
    previous = path;
  }
}

/**
 * Reject a station a line could not be read back with. A code of any other width would run into
 * the one after it and every station on the line would come back wrong.
 */
export function checkCodeWidths(stopIds: StopID[]): void {
  const wrong = stopIds.filter(stop => stop.length !== CODE_WIDTH);

  if (wrong.length > 0) {
    throw new Error(
      `Transfer patterns are written with ${CODE_WIDTH} character station codes, but ` +
      `${wrong.length} of ${stopIds.length} are a different length, starting with ` +
      `${wrong.slice(0, 5).map(stop => `"${stop}"`).join(", ")}`
    );
  }
}
