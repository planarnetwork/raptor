![Raptor](logo.png)

Raptor Journey Planner
=========================
![npm](https://img.shields.io/npm/v/raptor-journey-planner.svg?style=flat-square)

A near direct implementation of the [Round bAsed Public Transit Optimized Router (Raptor)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf) journey planning algorithm as described in the paper. 

It does not contain the multi-threading or multi-criteria (mcRaptor) variants but does contain the range query (rRaptor) algorithm.

Additional features not in the paper implementation:
 - Calendars are checked to ensure services are running on the specified day
 - Multi-day journeys
 - The origin and destination may be a set of stops
 - Interchange time at each station is applied
 - Pickup / set down marker of stop times are obeyed
 - Multi-criteria journey filtering
 - Taking a footpath counts towards the number of changes (journey legs)
 - Journeys are planned between stations, and platforms are retained for display

## Stops and stations

Journeys are planned between stations, because that is where interchange time and transfers are
defined and the only place a change of vehicle is possible. `loadGTFS` returns stops as the feed
gives them; they are resolved when the timetable is created, following `parent_station` up through
however many levels of grouping the feed uses. Pass the stop index to
`RaptorAlgorithmFactory.create` and this happens for you.

Stations are identified by their `stop_code`, falling back to `stop_id` where a feed does not give
one. That is the identifier queries are made with and journeys are returned in. A feed that
identifies platforms has to give its stations ids of its own, and `stop_code` is where it puts the
code the station is actually known by — a CRS code for UK rail. GTFS places no uniqueness
requirement on `stop_code`, so a feed that gives two stations the same one is rejected when the
timetable is created, rather than silently planning them as the same place.

Nothing is lost. Each stop time keeps the feed's `stop_id` as `platformStop`, and each trip keeps
its full stopping pattern as `allStopTimes`. The legs of a journey are cut from that pattern, so
they include the passing points between the stop boarded at and the stop alighted at. Filter on
`pickUp` or `dropOff` for the calls a passenger can use.

## Usage

It will work with any well-formed GTFS data set.
 
Node 20 or later is required for all examples.

```
npm install --save raptor-journey-planner
``` 

### Depart After Query

Find the first results that depart after a specific time

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, DepartAfterQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, stops] = await loadGTFS(fs.createReadStream("gtfs.zip"));
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, stops);
const resultsFactory = new JourneyFactory();
const query = new DepartAfterQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", "STA", new Date(), 9 * 60 * 60);
```

### Group Station Depart After Query

Find results from multiple origin and destinations

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, GroupStationDepartAfterQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, stops] = await loadGTFS(fs.createReadStream("gtfs.zip"));
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, stops);
const resultsFactory = new JourneyFactory();
const query = new GroupStationDepartAfterQuery(raptor, resultsFactory);
const journeys = query.plan(["NRW"], ["LST", "EUS"], new Date(), 9 * 60 * 60);
```

### Range Query

Find results departing between a time range

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, RangeQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, stops] = await loadGTFS(fs.createReadStream("gtfs.zip"));
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, stops);
const resultsFactory = new JourneyFactory();
const query = new RangeQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", "LST", new Date(), 9 * 60 * 60, 11 * 60 * 60);
```

### Transfer Pattern Query

Finds transfer patterns for a stop on a given date

```
const fs = require("fs");
const {loadGTFS, StringResults, RaptorAlgorithmFactory, TransferPatternQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, stops] = await loadGTFS(fs.createReadStream("gtfs.zip"));
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, stops);
const resultsFactory = () => new StringResults();
const query = new TransferPatternQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", new Date());
```

### Filters

By default the multi-criteria filter will keep journeys as long as there are no subsequent journeys that arrive sooner and have the same or less changes.

```
const fs = require("fs");
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, RangeQuery, MultipleCriteriaFilter} = require("raptor-journey-planner");

const [trips, transfers, interchange, stops] = await loadGTFS(fs.createReadStream("gtfs.zip"));
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, stops);
const resultsFactory = new JourneyFactory();
const filter = new MultipleCriteriaFilter();
const maxSearchDays = 3;
const query = new RangeQuery(raptor, resultsFactory, maxSearchDays, [filter]);
const journeys = query.plan("NRW", "LST", new Date(), 9 * 60 * 60, 11 * 60 * 60);
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

