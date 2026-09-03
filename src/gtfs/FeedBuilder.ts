import type { CalendarIndex, DateIndex, Interchange, StopIndex, TransfersByOrigin, Trip } from "./GTFS.js";
import type { EntityType } from "./EntityType.js";
import type { Row } from "./CSVParser.js";
import type { FeedInfo, GTFSFeed } from "./GTFSLoader.js";
import { TimeParser } from "./TimeParser.js";
import { Service } from "./Service.js";

/**
 * Assembles a feed from the rows of its files, whatever delivered them.
 *
 * Rows are taken one at a time and in the order the file gives them, because the order of a trip's
 * stop times is the order of its calls. Nothing is resolved to stations here; the feed is kept in
 * its own terms and normalised when the timetable is built.
 */
export class FeedBuilder {

  private readonly timeParser = new TimeParser();
  private readonly trips: Trip[] = [];
  private readonly transfers: TransfersByOrigin = {};
  private readonly interchange: Interchange = {};
  private readonly calendars: CalendarIndex = {};
  private readonly dates: Record<string, DateIndex> = {};
  private readonly stops: StopIndex = {};
  /**
   * Keyed by trip rather than stored on the trip, because stop_times.txt may arrive before
   * trips.txt. A Map rather than an object: a feed has hundreds of thousands of trips, and an
   * object that large goes into dictionary mode and internalises every id used as a key.
   */
  private readonly stopTimes = new Map<string, Trip["stopTimes"]>();
  /** One string per distinct id, see intern */
  private readonly pool = new Map<string, string>();
  private feedInfo: FeedInfo | undefined;

  /**
   * Take a row of one of the feed's files.
   */
  public add(type: EntityType, row: Row): void {
    switch (type) {
      case "transfer": this.addTransfer(row); break;
      case "calendar": this.addCalendar(row); break;
      case "calendar_date": this.addCalendarDate(row); break;
      case "trip": this.addTrip(row); break;
      case "stop_time": this.addStopTime(row); break;
      case "feed_info": this.addFeedInfo(row); break;
      case "stop": this.addStop(row); break;
    }
  }

  /**
   * Give every trip its calendar and its stop times, and return the feed.
   */
  public build(): GTFSFeed {
    const services: Record<string, Service> = {};

    for (const c of Object.values(this.calendars)) {
      services[c.serviceId] = new Service(c.startDate, c.endDate, c.days, this.dates[c.serviceId] || {});
    }

    for (const t of this.trips) {
      t.stopTimes = this.stopTimes.get(t.tripId) || [];
      t.service = services[t.serviceId];
    }

    return {
      trips: this.trips,
      transfers: this.transfers,
      interchange: this.interchange,
      stops: this.stops,
      feedInfo: this.feedInfo
    };
  }

  /**
   * The one string for an id, so that the millions of rows naming a few thousand stops between
   * them share a few thousand strings.
   *
   * The copy is not idle. A field is a slice of the chunk it was decoded from, and a slice keeps
   * the whole of that chunk alive, so pooling the slice as it comes would pin every chunk that
   * happened to introduce an id: for a 200MB stop_times.txt, all of it. Copying the characters out
   * frees the chunk. Prefixing and re-slicing is the cheapest way to make the engine do that.
   */
  private intern(value: string): string {
    const existing = this.pool.get(value);

    if (existing !== undefined) {
      return existing;
    }

    const copy = ` ${value}`.slice(1);

    this.pool.set(copy, copy);

    return copy;
  }

  private addTransfer(row: Row): void {
    this.footpath(
      row,
      +(row.min_transfer_time as string),
      row.start_time ? this.timeParser.getTime(row.start_time) : 0,
      row.end_time ? this.timeParser.getTime(row.end_time) : Number.MAX_SAFE_INTEGER
    );
  }

  /**
   * A footpath from a stop back to itself is not a walk between places, it is how long changing
   * vehicles there takes.
   */
  private footpath(row: Row, duration: number, startTime: number, endTime: number): void {
    const origin = this.intern(row.from_stop_id as string);
    const destination = this.intern(row.to_stop_id as string);

    if (origin === destination) {
      this.interchange[origin] = duration;
    }
    else {
      const transfers = this.transfers[origin] ?? [];

      transfers.push({ origin, destination, duration, startTime, endTime });
      this.transfers[origin] = transfers;
    }
  }

  private addCalendar(row: Row): void {
    this.calendars[row.service_id as string] = {
      serviceId: row.service_id as string,
      startDate: +(row.start_date as string),
      endDate: +(row.end_date as string),
      days: {
        0: row.sunday === "1",
        1: row.monday === "1",
        2: row.tuesday === "1",
        3: row.wednesday === "1",
        4: row.thursday === "1",
        5: row.friday === "1",
        6: row.saturday === "1"
      },
      include: {},
      exclude: {}
    };
  }

  private addCalendarDate(row: Row): void {
    const serviceId = row.service_id as string;
    const dates = this.dates[serviceId] ?? {};

    dates[row.date as string] = row.exception_type === "1";
    this.dates[serviceId] = dates;
  }

  private addTrip(row: Row): void {
    this.trips.push({
      serviceId: this.intern(row.service_id as string),
      tripId: this.intern(row.trip_id as string),
      stopTimes: [],
      service: {} as Service
    });
  }

  private addStopTime(row: Row): void {
    const tripId = this.intern(row.trip_id as string);
    const stopTime = {
      stop: this.intern(row.stop_id as string),
      departureTime: this.timeParser.getTime(row.departure_time as string),
      arrivalTime: this.timeParser.getTime(row.arrival_time as string),
      // a feed leaves these empty for an ordinary call, so anything but an explicit code allows it
      pickUp: row.pickup_type === "0" || row.pickup_type === undefined,
      dropOff: row.drop_off_type === "0" || row.drop_off_type === undefined
    };

    const stopTimes = this.stopTimes.get(tripId);

    if (stopTimes === undefined) {
      this.stopTimes.set(tripId, [stopTime]);
    }
    else {
      stopTimes.push(stopTime);
    }
  }

  private addFeedInfo(row: Row): void {
    this.feedInfo = {
      startDate: row.feed_start_date ? +row.feed_start_date : undefined,
      endDate: row.feed_end_date ? +row.feed_end_date : undefined,
      version: row.feed_version
    };
  }

  private addStop(row: Row): void {
    const id = this.intern(row.stop_id as string);

    this.stops[id] = {
      id,
      code: row.stop_code as string,
      name: row.stop_name as string,
      description: row.stop_desc as string,
      latitude: +(row.stop_lat as string),
      longitude: +(row.stop_lon as string),
      timezone: row.zone_id as string,
      locationType: +(row.location_type ?? 0),
      parentStation: row.parent_station === undefined ? undefined : this.intern(row.parent_station),
      platformCode: row.platform_code
    };
  }

}
