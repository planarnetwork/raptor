![Raptor](logo.png)

Raptor Journey Planner
=========================
[![Travis](https://img.shields.io/travis/planarnetwork/raptor.svg?style=flat-square)](https://travis-ci.org/planarnetwork/raptor) ![npm](https://img.shields.io/npm/v/raptor-journey-planner.svg?style=flat-square) ![David](https://img.shields.io/david/planarnetwork/raptor.svg?style=flat-square)

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
 
## Usage

It will work with any well formed GTFS data set.
 
Node +11 is required for all examples.

```
npm install --save raptor-journey-planner
``` 

### Depart After Query

Find the first results that depart after a specific time

```
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, DepartAfterQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, calendars] = await loadGTFS("gtfs.zip");
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
const resultsFactory = new JourneyFactory();
const query = new DepartAfterQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", "STA", new Date(), 9 * 60 * 60);
```

### Group Station Depart After Query

Find results from multiple origin and destinations

```
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, GroupStationDepartAfterQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, calendars] = await loadGTFS("gtfs.zip");
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
const resultsFactory = new JourneyFactory();
const query = new GroupStationDepartAfterQuery(raptor, resultsFactory);
const journeys = query.plan(["NRW"], ["LST", "EUS"], new Date(), 9 * 60 * 60);
```

### Range Query

Find results departing between a time range

```
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, RangeQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, calendars] = await loadGTFS("gtfs.zip");
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
const resultsFactory = new JourneyFactory();
const query = new RangeQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", "LST", new Date(), 9 * 60 * 60, 11 * 60 * 60);
```

### Transfer Pattern Query

Finds transfer patterns for a stop on a given date

```
const {loadGTFS, StringResults, RaptorAlgorithmFactory, TransferPatternQuery} = require("raptor-journey-planner");

const [trips, transfers, interchange, calendars] = await loadGTFS("gtfs.zip");
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
const resultsFactory = () => new StringResults();
const query = new TransferPatternQuery(raptor, resultsFactory);
const journeys = query.plan("NRW", new Date());
```

### Filters

By default the multi-criteria filter will keep journeys as long as there are no subsequent journeys that arrive sooner and have the same or less changes.

```
const {loadGTFS, JourneyFactory, RaptorAlgorithmFactory, RangeQuery, MultipleCriteriaFilter} = require("raptor-journey-planner");

const [trips, transfers, interchange, calendars] = await loadGTFS("gtfs.zip");
const raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange, calendars);
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

