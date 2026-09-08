---
"raptor-journey-planner": minor
---

Remove transfer pattern generation, which now lives in transfer-pattern-planner.

This drops `TransferPatternQuery`, `StringResults`, `GraphResults`,
`TransferPatternResults`, `PatternFormat` and its `readPatterns`, `patternLines`,
`frontCode` and `checkCodeWidths`, `TransferPatternFile`, `TransferPatternMerge`,
and the `patterns` script that wrote a file for a whole feed.

The format was always the journey planner's data structure rather than the
algorithm's, and keeping the reading half in one repository and the writing half in
another meant two copies of one encoding that were free to drift. Both halves are
in transfer-pattern-planner now, where `npm run patterns` writes a file and a query
reads it back. It depends on this package to do the scanning.

Nothing the algorithm does has changed.
