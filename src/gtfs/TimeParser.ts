
/**
 * Parses time strings and returns them as seconds from midnight. Caches results.
 *
 * A Map rather than an object: the cache is looked up twice per stop time, so several million times
 * over a national feed, and an object lookup has to internalise the string being looked up first.
 * Worth about 3% of the load on the GB rail feed, which is small but consistent.
 */
export class TimeParser {

  private readonly timeCache = new Map<string, number>();

  /**
   * Convert a time string to seconds from midnight
   */
  public getTime(time: string) {
    const cached = this.timeCache.get(time);

    if (cached !== undefined) {
      return cached;
    }

    const [hh, mm, ss] = time.split(":");
    const seconds = (+hh) * 60 * 60 + (+mm) * 60 + (+ss);

    this.timeCache.set(time, seconds);

    return seconds;
  }

}
