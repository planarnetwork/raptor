---
"raptor-journey-planner": minor
---

Carry the feed's areas across the worker boundary.

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
