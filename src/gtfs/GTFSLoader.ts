import { plain as gtfs } from "gtfs-stream";
import type {CalendarIndex, DateNumber, Interchange, StopIndex, TransfersByOrigin, Trip} from "./GTFS";
import {pushNested, setNested} from "ts-array-utils";
import type {Readable} from "node:stream";
import {TimeParser} from "./TimeParser";
import { Service } from "./Service";

/**
 * Returns the contents of a GTFS zip.
 *
 * Stops are returned as the feed gives them. Resolving them to the stations the algorithm plans
 * between is done when the timetable is created.
 */
export function loadGTFS(stream: Readable): Promise<GTFSFeed> {
  const timeParser = new TimeParser();
  const trips: Trip[] = [];
  const transfers = {};
  const interchange = {};
  const calendars: CalendarIndex = {};
  const dates = {};
  const stopTimes = {};
  const stops: StopIndex = {};
  let feedInfo: FeedInfo | undefined;

  const addTransfer = (row, duration: number, startTime: number, endTime: number) => {
    if (row.from_stop_id === row.to_stop_id) {
      interchange[row.from_stop_id] = duration;
    }
    else {
      const t = {
        origin: row.from_stop_id,
        destination: row.to_stop_id,
        duration,
        startTime,
        endTime
      };

      pushNested(t, transfers, row.from_stop_id);
    }
  };

  const processor = {
    link: row => {
      addTransfer(row, +row.duration, timeParser.getTime(row.start_time), timeParser.getTime(row.end_time));
    },
    calendar: row => {
      calendars[row.service_id] = {
        serviceId: row.service_id,
        startDate: +row.start_date,
        endDate: +row.end_date,
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
    },
    calendar_date: row => {
      setNested(row.exception_type === "1", dates, row.service_id, row.date);
    },
    trip: row => {
      trips.push({ serviceId: row.service_id, tripId: row.trip_id, stopTimes: [], service: {} as Service });
    },
    stop_time: row => {
      const stopTime = {
        stop: row.stop_id,
        departureTime: timeParser.getTime(row.departure_time),
        arrivalTime: timeParser.getTime(row.arrival_time),
        pickUp: row.pickup_type === "0" || row.pickup_type === undefined,
        dropOff: row.drop_off_type === "0" || row.drop_off_type === undefined
      };

      pushNested(stopTime, stopTimes, row.trip_id);
    },
    transfer: row => {
      // a feed that puts the footpaths in transfers.txt rather than links.txt gives them a window
      addTransfer(
        row,
        +row.min_transfer_time,
        row.start_time ? timeParser.getTime(row.start_time) : 0,
        row.end_time ? timeParser.getTime(row.end_time) : Number.MAX_SAFE_INTEGER
      );
    },
    feed_info: row => {
      feedInfo = {
        startDate: row.feed_start_date ? +row.feed_start_date : undefined,
        endDate: row.feed_end_date ? +row.feed_end_date : undefined,
        version: row.feed_version
      };
    },
    stop: row => {
      const stop = {
        id: row.stop_id,
        code: row.stop_code,
        name: row.stop_name,
        description: row.stop_desc,
        latitude: +row.stop_lat,
        longitude: +row.stop_lon,
        timezone: row.zone_id,
        locationType: +(row.location_type ?? 0),
        parentStation: row.parent_station,
        platformCode: row.platform_code
      };

      setNested(stop, stops, row.stop_id);
    }
  };

  return new Promise(resolve => {
    stream
      .pipe(gtfs({ raw: true }))
      .on("data", entity => processor[entity.type] && processor[entity.type](entity.data))
      .on("end", () => {
        const services = {};

        for (const c of Object.values(calendars)) {
          services[c.serviceId] = new Service(c.startDate, c.endDate, c.days, dates[c.serviceId] || {});
        }

        for (const t of trips) {
          t.stopTimes = stopTimes[t.tripId] || [];
          t.service = services[t.serviceId];
        }

        resolve({ trips, transfers, interchange, stops, feedInfo });
      });
  });

}

/**
 * Contents of the GTFS zip file
 */
export interface GTFSFeed {
  trips: Trip[];
  transfers: TransfersByOrigin;
  interchange: Interchange;
  stops: StopIndex;
  /** feed_info.txt, which a feed does not have to provide */
  feedInfo?: FeedInfo;
}

/**
 * The period the feed covers, and the version it was published as
 */
export interface FeedInfo {
  startDate?: DateNumber;
  endDate?: DateNumber;
  version?: string;
}
