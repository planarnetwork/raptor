---
"raptor-journey-planner": patch
---

Put a journey found over more than one day onto one clock.

A query that finds nothing on the day it is asked for searches the next one, and
stitches the two days together. The stitched journey's `arrivalTime` already
carried the day it gained, but its legs did not: each day is scanned on its own
and hands back the times the feed writes for it, which count from that day's
midnight. So the second day's legs sat a day behind the first day's.

Anything reading the legs rather than the journey's own two times saw a journey
that arrived before it departed — a leg arriving at B at 1035 and the next one
leaving B at 1030 — and every duration taken from them came out short by a day,
or negative.

The legs of the following day are now moved forward a day as they are merged, so
that every time in a journey counts in seconds from the midnight it departed and
runs past a day rather than wrapping. That is how a feed writes an overnight trip
already: a train leaving at 23:50 and arriving twenty minutes into the next day
arrives at 24:10. A duration is a subtraction either way.

The stop times are copied rather than adjusted in place, since they are the
feed's own and shared with every other journey over the same trip. A transfer is
left alone, the times it carries being the window it is available in rather than
when it was made.

`isTimetableLeg` is now exported, for callers that walk a journey's legs.
