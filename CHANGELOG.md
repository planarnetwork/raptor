# raptor-journey-planner

## 5.2.0

### Minor Changes

- 47d4cf8: Carry the feed's areas across the worker boundary.
  
  `load` now hands back an `areas` index alongside `routes` and `agencies` —
  `areas.txt` and `stop_areas.txt` read as one thing, which is where a group station
  lives. GTFS has no station of stations, so "London Terminals" is an area holding
  eighteen stops rather than a parent of them.
  
  The loader has parsed areas since `@gb-transit/gtfs-loader` 1.2.0, but the worker
  kept them: the feed stays inside it and only the journeys asked for come back, so
  the only way to a group station was to read the zip a second time. An area names
  stop ids and a query is asked in stations, so `stops()` still resolves one to the
  other; both now come from the same load.
  
  Additive — nothing that reads the existing fields changes. `Area`, `AreaID` and
  `AreaIndex` are re-exported for callers that want to name the type.
- 03e67f7: Remove transfer pattern generation, which now lives in transfer-pattern-planner.
  
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

## 5.1.0

### Minor Changes

- 9b974d7: Carry route and operator information across the worker boundary.
  
  A trip now crosses as everything the loader holds less its `Service`, so a leg arrives with the
  route it runs on, its `shortName` and its `headsign` — a headcode and a destination, for a UK rail
  feed. `PlannerClient.load` returns the feed's `routes` and `agencies` alongside the counts, sent
  once rather than denormalised onto every leg, so a leg's `routeId` resolves to a route and on to
  the operator that runs it.
  
  Requires `@gb-transit/gtfs-loader` 1.2.0, which reads `routes.txt` and `agency.txt`.
