![Raptor](logo.png)

Raptor Journey Planner
=========================
![npm](https://img.shields.io/npm/v/raptor-journey-planner.svg?style=flat-square)

A near direct implementation of the [Round bAsed Public Transit Optimized Router (Raptor)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf) journey planning algorithm as described in the paper. 

It contains the range query (rRaptor) algorithm and runs across multiple threads: a range query can
spread its scans over a pool of workers, and separate depart after queries can be answered
concurrently by that same pool. It does not contain the multi-criteria (mcRaptor) variant, although
results can be filtered on multiple criteria after they are found.

Additional features not in the paper implementation:
 - Calendars are checked to ensure services are running on the specified day
 - Multi-day journeys
 - The origin and destination may be a set of stops
 - Interchange time at each station is applied
 - Pickup / set down marker of stop times are obeyed
 - Multi-criteria journey filtering
 - Taking a footpath counts towards the number of changes (journey legs)
 - Journeys are planned between stations, and platforms are retained for display

## Installation

It will work with any well-formed GTFS data set.
 
Node 22 or later is required for all examples.

```
npm install --save raptor-journey-planner
```

The package ships both CommonJS and ES modules, so `require` and `import` both work. The examples
below use `require`; the equivalent `import` is the same names from the same place.

`@gb-transit/gtfs-loader` is the only runtime dependency.

## Queries

Every query is built the same way: load a feed, create a network from it, then plan.

### Depart After Query

Find the first results that depart after a specific time

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, createNetwork, DepartAfterQuery} = require("raptor-journey-planner");

const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork(feed);
const resultsFactory = new JourneyFactory();
const query = new DepartAfterQuery(network, resultsFactory);
const journeys = query.plan("NRW", "STA", new Date(), 9 * 60 * 60);
```

### Group Station Depart After Query

Find results from multiple origin and destinations

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, createNetwork, GroupStationDepartAfterQuery} = require("raptor-journey-planner");

const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork(feed);
const resultsFactory = new JourneyFactory();
const query = new GroupStationDepartAfterQuery(network, resultsFactory);
const journeys = query.plan(["NRW"], ["LST", "EUS"], new Date(), 9 * 60 * 60);
```

### Range Query

Find results departing between a time range

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, createNetwork, RangeQuery} = require("raptor-journey-planner");

const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork(feed);
const resultsFactory = new JourneyFactory();
const query = new RangeQuery(network, resultsFactory);
const journeys = query.plan("NRW", "LST", new Date(), 9 * 60 * 60, 11 * 60 * 60);
```

### Parallel Range Query

Runs the scans of a range query on a pool of planners instead of one after another, and stops once
it has enough journeys.

You supply the pool. A planner is anything with an async `plan` matching `GroupStationDepartAfterQuery`,
so it is usually a worker holding its own network, or a `PlannerClient`.

```
const {createNetwork, ParallelRangeQuery, MultipleCriteriaFilter} = require("raptor-journey-planner");

const network = createNetwork(feed);
const planners = workers.map(worker => new PlannerClient(worker));
const query = new ParallelRangeQuery(network, planners, [new MultipleCriteriaFilter()]);
const journeys = await query.plan("NRW", "LST", new Date(), 1, 24 * 60 * 60, 20);
```

The scans are dispatched in batches the size of the pool, so asking for 20 journeys may return a
few more: the batch that reaches the target is finished rather than abandoned.

### Parallel Depart After Query

Sends each query to the planner in a pool with the least work outstanding. This answers more
queries at once, it does not make a single query faster.

```
const {ParallelDepartAfterQuery} = require("raptor-journey-planner");

const query = new ParallelDepartAfterQuery(planners);
const journeys = await query.plan("NRW", "LST", new Date(), 9 * 60 * 60);
```

### Filters

By default the multi-criteria filter will keep journeys as long as there are no subsequent journeys that arrive sooner and have the same or less changes.

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, createNetwork, RangeQuery, MultipleCriteriaFilter} = require("raptor-journey-planner");

const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork(feed);
const resultsFactory = new JourneyFactory();
const filter = new MultipleCriteriaFilter();
const maxSearchDays = 3;
const query = new RangeQuery(network, resultsFactory, maxSearchDays, [filter]);
const journeys = query.plan("NRW", "LST", new Date(), 9 * 60 * 60, 11 * 60 * 60);
```

## Loading a feed

`loadGTFS` takes whatever the environment can give bytes from, and reads the zip as it arrives
rather than after it has all been collected, so parsing overlaps the download:

```js
await loadGTFS(fs.createReadStream("gtfs.zip"));  // a node stream
await loadGTFS(await file.arrayBuffer());          // bytes
await loadGTFS(fileInput.files[0]);                // a File or Blob
await loadGTFS(await fetch(url));                  // a Response
```

or `loadGTFSFromUrl`, which does the fetch for you:

```js
const feed = await loadGTFSFromUrl("https://example.com/gtfs.zip", {
  onProgress: p => console.log(`${p.phase} ${p.entry ?? ""} ${p.rows} rows`)
});
```

`onProgress` reports the bytes read, the file being read and how far through it we are, and the
number of rows so far. It is throttled to `progressInterval` milliseconds, 100 by default, so it
is safe to render from directly.

## In the browser

Loading a feed is slow enough to be worth keeping off the main thread. `PlannerClient` talks to a
worker that holds the feed and the timetable, so only the journeys you ask for cross back:

```js
import { PlannerClient } from "raptor-journey-planner";

const worker = new Worker(new URL("raptor-journey-planner/worker", import.meta.url), { type: "module" });
const planner = new PlannerClient(worker);

await planner.load({ url: "/gtfs.zip" }, { onProgress: p => setProgress(p) });

const journeys = await planner.plan(["NRW"], ["LST"], new Date(), 9 * 60 * 60);
```

You construct the `Worker` yourself because resolving a worker's URL is a question for whatever is
bundling your application, and any helper here would only ever be right for one bundler. The entry
point is a plain ES module, which every bundler understands and a browser can load natively.

Two things to know about what comes back. The journeys are copies, so a leg's `trip` is not the
same object the worker holds and cannot be used as a key against one. And a trip arrives without
its `service`: a class does not survive being posted, so it would arrive with its fields and
without its `runsOn`, which is worse than leaving it out. Whether a trip runs on a date is settled
inside the worker before the journey is returned.

`load` hands back the feed's routes and agencies along with what it loaded. A leg names the route
its trip runs on and stops there, so these are what turn that id into a route and an operator. They
are sent once, when the feed loads, because a feed has few of them — the GB feed has 98 routes and
41 agencies against 290,640 trips — and copying an operator's name onto every leg of every journey
would cost more:

```js
const feed = await planner.load({ url: "/gtfs.zip" });
const [journey] = await planner.plan(["PAD"], ["PLY"], new Date(), 9 * 60 * 60);
const { trip } = journey.legs[0];
const route = feed.routes[trip.routeId];

`${trip.shortName} to ${trip.headsign}, ${feed.agencies[route.agencyId].name}`;
// "GW130700 to Plymouth, GWR"
```

A feed need not name either, so `routeId` may be missing and the indexes empty.

`load` hands back the feed's areas too — `areas.txt` and `stop_areas.txt` read as one thing. Nothing
the algorithm does refers to one: an area is a fares construct, and no journey mentions it. It is
here because a group station has nowhere else to live. GTFS has no station of stations —
`parent_station` is forbidden on a station and the hierarchy is one level deep — so "London
Terminals" is an area holding eighteen stops rather than a parent of them, and `transfers.txt` is
the wrong tool for the job because it asserts a rider can walk between the two stops, which Euston
and Waterloo are not.

An area names stop ids as the feed wrote them, and a query is asked in stations, so `stops()`
resolves one to the other. Both come from the same load, so planning between group stations needs
no second reading of the zip:

```js
const feed = await planner.load({ url: "/gtfs.zip" });
const stops = await planner.stops();
const byId = new Map(stops.map(stop => [stop.id, stop]));

const terminals = feed.areas["1072"].stops.map(id => byId.get(id).code);
await planner.plan(["BTN"], terminals, new Date(), 9 * 60 * 60);
```

The index is empty for a feed with no `areas.txt`, which most feeds are.

Passing `{ date }` to `load` restricts the timetable to that date, which makes it smaller and
queries faster.

## Stops and stations

Journeys are planned between stations, because that is where interchange time and transfers are
defined and the only place a change of vehicle is possible. `loadGTFS` returns the feed exactly as
it finds it; stops are resolved to their station when the timetable is built, following
`parent_station` up through however many levels of grouping the feed uses.

Stations are identified by their `stop_code`, falling back to `stop_id` where a feed does not give
one. That is the identifier queries are made with and journeys are returned in. A feed that
identifies platforms has to give its stations ids of its own, and `stop_code` is where it puts the
code the station is actually known by — a CRS code for UK rail. GTFS places no uniqueness
requirement on `stop_code`, so a feed that gives two stations the same one is rejected when the
timetable is created, rather than silently planning them as the same place.

Nothing is lost, because nothing is rewritten. The trips a journey hands back are the feed's own,
so a leg's stop times carry the feed's `stop_id` — the platform, where the feed identifies one —
and include the passing points between the stop boarded at and the stop alighted at. Filter on
`pickUp` or `dropOff` for the calls a passenger can use, and `network.stations` maps a stop to the
station the algorithm planned it as.

## Dates

The timetable holds a calendar for a fixed period, taken from `feed_info.txt` where the feed gives
one and 120 days from today where it does not. Planning for a date outside that period throws
rather than quietly finding nothing. To plan for a different period, set `feedInfo` on the feed
before building:

```
const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork({ ...feed, feedInfo: { startDate: 20250901, endDate: 20251101 } });
```

## Contributing

Issues and PRs are very welcome. To get the project set up run:

```
git clone git@github.com:planarnetwork/raptor
npm install --dev
npm test
```

If you would like to send a pull request please write your contribution in TypeScript and if possible, add a test.

## License

This software is licensed under [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html).
