Raptor Journey Planner
=========================
[![Travis](https://img.shields.io/travis/planarnetwork/raptor.svg?style=flat-square)](https://travis-ci.org/planarnetwork/raptor) ![npm](https://img.shields.io/npm/v/raptor-journey-planner.svg?style=flat-square) ![David](https://img.shields.io/david/planarnetwork/raptor.svg?style=flat-square)

A near direct implementation of the [Round bAsed Public Transit Optimized Router (Raptor)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf) journey planning algorithm as described in the paper. It does not contain the multi-threading or multi-criteria (mcRaptor) variants but does contain the range query (rRaptor) algorithm.

## Usage

The algorithm can be run on any GTFS data set.

```
npm install --save raptor-journey-planner
```

## Testing
 
```
npm test
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

