---
"raptor-journey-planner": minor
---

Carry route and operator information across the worker boundary.

A trip now crosses as everything the loader holds less its `Service`, so a leg arrives with the
route it runs on, its `shortName` and its `headsign` — a headcode and a destination, for a UK rail
feed. `PlannerClient.load` returns the feed's `routes` and `agencies` alongside the counts, sent
once rather than denormalised onto every leg, so a leg's `routeId` resolves to a route and on to
the operator that runs it.

Requires `@gb-transit/gtfs-loader` 1.2.0, which reads `routes.txt` and `agency.txt`.
