Raptor Journey Planner
=========================
[![Travis](https://img.shields.io/travis/planarnetwork/raptor.svg?style=flat-square)](https://travis-ci.org/planarnetwork/raptor) ![npm](https://img.shields.io/npm/v/raptor-journey-planner.svg?style=flat-square) ![David](https://img.shields.io/david/planarnetwork/raptor.svg?style=flat-square)

A near direct implementation of the [Round bAsed Public Transit Optimized Router (Raptor)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf) journey planning algorithm as described in the paper. 

It does not contain the multi-threading or multi-criteria (mcRaptor) variants but does contain the range query (rRaptor) algorithm.

Variations from the paper implementation:
- Taking a footpath counts towards the number of changes (journey legs)
- Interchange time at each station is applied
- Pickup / set down marker of stop times are obeyed
- Calendars are checked to ensure services are running on the specified day

## Status

Work in progress.

## Usage

The algorithm can be run on any GTFS data set via the CLI.

```
sudo npm install -g raptor-journey-planner
raptor gtfs.zip stopA stopB yyyyMMdd

# e.g
raptor gb-rail.zip NRW STA 20180515
```

Alternatively, it can be used as a library:

```
import {Raptor} from "raptor-journey-planner";

const raptor = new Raptor(trips, transfers, interchange);
const journeys = raptor.plan("NRW", "STA", 20180515);
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

