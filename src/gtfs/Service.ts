import type { DateIndex, DateNumber, DayOfWeek } from "./GTFS.js";
import { addDays } from "../query/DateUtil.js";

/**
 * The days a trip runs on.
 */
export interface ServiceCalendar {
  runsOn(date: DateNumber, dow: DayOfWeek): boolean;
  /** The same days told a day earlier, so "runs on the day after" can be asked as "runs on" */
  dayEarlier(): ServiceCalendar;
}

export class Service implements ServiceCalendar {

  constructor(
    private readonly startDate: DateNumber,
    private readonly endDate: DateNumber,
    private readonly days: Record<DayOfWeek, boolean>,
    private readonly dates: DateIndex,
  ) {}

  public runsOn(date: number, dow: DayOfWeek): boolean {
    return this.dates[date] || (
      !Object.hasOwn(this.dates, date) &&
      this.startDate <= date &&
      this.endDate >= date &&
      this.days[dow]
    );
  }

  public dayEarlier(): Service {
    const days = {} as Record<DayOfWeek, boolean>;
    const dates: DateIndex = {};

    for (let day = 0; day < 7; day++) {
      days[day as DayOfWeek] = this.days[((day + 1) % 7) as DayOfWeek];
    }

    for (const date of Object.keys(this.dates)) {
      dates[addDays(+date, -1)] = this.dates[+date];
    }

    return new Service(addDays(this.startDate, -1), addDays(this.endDate, -1), days, dates);
  }
}

/**
 * A trip made of two coupled trips runs on the days both of them do.
 */
export class LinkedService implements ServiceCalendar {

  constructor(
    private readonly from: ServiceCalendar,
    private readonly to: ServiceCalendar
  ) {}

  public runsOn(date: DateNumber, dow: DayOfWeek): boolean {
    return this.from.runsOn(date, dow) && this.to.runsOn(date, dow);
  }

  public dayEarlier(): LinkedService {
    return new LinkedService(this.from.dayEarlier(), this.to.dayEarlier());
  }
}
