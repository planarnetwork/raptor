import type { StopID, StopTime, Trip, TripID, TripLink } from "./GTFS.js";
import { LinkedService, type ServiceCalendar } from "./Service.js";

const SECONDS_IN_DAY = 86400;

/**
 * The trips a passenger can stay on across a coupling, one per link.
 *
 * A link says a vehicle carries on as another trip, so staying on it is a trip in its own right:
 * the arriving trip's calls up to the coupling, then the departing trip's. The two trips are left
 * as they are and the through trip is added alongside them, because each still runs alone on the
 * days the other does not, and each is still boarded by passengers who really do change.
 *
 * A trip tells its times in its own service day, so a portion leaving after midnight departs
 * earlier in the day than the trip it continues arrived. It is moved onto the arriving trip's day,
 * forwards only, so that the through trip reads from its first call however the feed dated it.
 */
export function linkTrips(
  trips: Trip[],
  links: TripLink[],
  station: (stop: StopID) => StopID
): Trip[] {
  if (links.length === 0) {
    return [];
  }

  const byId = index(trips, links);
  const dayEarlier = new Map<ServiceCalendar, ServiceCalendar>();
  const linked: Trip[] = [];

  for (const link of links) {
    const from = byId.get(link.fromTripId);
    const to = byId.get(link.toTripId);

    if (from === undefined || to === undefined) {
      continue;
    }

    const alights = indexOfStop(from.stopTimes, link.fromStop, station, true);
    const boards = indexOfStop(to.stopTimes, link.toStop, station, false);

    if (alights === -1 || boards === -1) {
      continue;
    }

    const arrival = from.stopTimes[alights].arrivalTime;
    const departure = to.stopTimes[boards].departureTime;
    const shift = departure < arrival ? SECONDS_IN_DAY : 0;

    // a coupling more than a day apart is not one a day's shift can put in order
    if (departure + shift < arrival) {
      continue;
    }

    linked.push({
      tripId: `${from.tripId}_${to.tripId}`,
      serviceId: `${from.serviceId}_${to.serviceId}`,
      stopTimes: join(from.stopTimes, alights, to.stopTimes, boards, shift),
      service: new LinkedService(from.service, shift === 0 ? to.service : earlier(dayEarlier, to.service))
    });
  }

  return linked;
}

/**
 * Every trip a link names.
 *
 * Planning for a single date keeps only the trips running on it, and a portion leaving after
 * midnight runs on the day after the trip it continues, so the coupled trips are kept whatever date
 * is planned for. The calendar still decides which of them can be boarded.
 */
export function coupledTripIds(links: TripLink[]): Set<TripID> {
  const ids = new Set<TripID>();

  for (const link of links) {
    ids.add(link.fromTripId);
    ids.add(link.toTripId);
  }

  return ids;
}

/**
 * The trips the links name. Only a few thousand trips of a feed's hundreds of thousands are coupled,
 * so they are picked out rather than all of them indexed.
 */
function index(trips: Trip[], links: TripLink[]): Map<TripID, Trip> {
  const wanted = coupledTripIds(links);
  const byId = new Map<TripID, Trip>();

  for (const trip of trips) {
    if (wanted.has(trip.tripId)) {
      byId.set(trip.tripId, trip);
    }
  }

  return byId;
}

/**
 * The two trips' calls as one, sharing a single call at the coupling: the passenger arrives on the
 * first trip and leaves on the second, so that call is set down by one and picked up by the other.
 */
function join(
  from: StopTime[],
  alights: number,
  to: StopTime[],
  boards: number,
  shift: number
): StopTime[] {
  const stopTimes = from.slice(0, alights);

  stopTimes.push({
    ...from[alights],
    departureTime: to[boards].departureTime + shift,
    pickUp: to[boards].pickUp
  });

  for (let i = boards + 1; i < to.length; i++) {
    stopTimes.push(shift === 0 ? to[i] : {
      ...to[i],
      arrivalTime: to[i].arrivalTime + shift,
      departureTime: to[i].departureTime + shift
    });
  }

  return stopTimes;
}

/**
 * Where the coupling is within a trip: the last call there for the trip being left, the first for
 * the one being joined, which is as far as the passenger rides one and as early as they board the
 * other. A link that names no stop couples the trips end to end.
 */
function indexOfStop(
  stopTimes: StopTime[],
  stop: StopID | undefined,
  station: (stop: StopID) => StopID,
  last: boolean
): number {
  if (stop === undefined) {
    return last ? stopTimes.length - 1 : 0;
  }

  const at = station(stop);

  for (let i = 0; i < stopTimes.length; i++) {
    const position = last ? stopTimes.length - 1 - i : i;

    if (station(stopTimes[position].stop) === at) {
      return position;
    }
  }

  return -1;
}

function earlier(
  cache: Map<ServiceCalendar, ServiceCalendar>,
  service: ServiceCalendar
): ServiceCalendar {
  let shifted = cache.get(service);

  if (shifted === undefined) {
    shifted = service.dayEarlier();
    cache.set(service, shifted);
  }

  return shifted;
}
