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

### Transfer Pattern Query

Finds transfer patterns for a stop on a given date

```
const fs = require("fs");
const {loadGTFS, StringResults, createNetwork, TransferPatternQuery} = require("raptor-journey-planner");

const feed = await loadGTFS(fs.createReadStream("gtfs.zip"));
const network = createNetwork(feed);
const resultsFactory = () => new StringResults(feed.interchange);
const query = new TransferPatternQuery(network, resultsFactory);
const journeys = query.plan("NRW", new Date());
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

