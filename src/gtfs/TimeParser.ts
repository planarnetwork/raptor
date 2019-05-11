
/**
 * Parses time strings and returns them as seconds from midnight. Caches results
 */
export class TimeParser {

  private readonly timeCache = {};

  /**
   * Convert a time string to seconds from midnight
   */
  public getTime(time: string) {
    if (!this.timeCache.hasOwnProperty(time)) {
      const [hh, mm, ss] = time.split(":");

      this.timeCache[time] = (+hh) * 60 * 60 + (+mm) * 60 + (+ss);
    }

    return this.timeCache[time];
  }

}
