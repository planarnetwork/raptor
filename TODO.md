# Performance Optimization TODO

## Low-Level Optimizations

### 1. Object Initialization Pre-allocation
**DONE** — the queue is a `Map<RouteIdx, number>` built from flat typed arrays and the scan state is
pre-allocated typed arrays sized by the number of stops. See `Timetable.ts`.

### 2. Array Method Chain Optimization
**Files**: `RangeQuery.ts:48`, `GroupStationDepartAfterQuery.ts:88-93`, `MultipleCriteriaFilter.ts:29,46`
- Replace `Math.min(...newResults.map(j => j.departureTime))` with single-pass loop
- Replace `flatMap` chains with for-loops to reduce intermediate arrays
- Replace `.filter()` with traditional loops for hot paths
**Priority**: HIGH (hot path optimization)

### 3. Object Property Access Optimization
**DONE** — the scan reads stop times, stops and set down flags from flat typed arrays instead of
walking `trip.stopTimes[pi]`, and hoists the per-route offsets out of the loop.

### 4. hasOwnProperty Optimization
**DONE** in `RouteScanner`, which now keeps its scan positions in an `Int32Array`. `Service.ts:14`
still uses `hasOwn`.

### 5. String Operations
**DONE** — routes are dense integers. The signature string is only built once per trip when the
timetable is created, and never touched during a query.

### 6. ScanResults Initialization
**DONE** — `bestArrivals` and `kArrivals` are `Int32Array`s and the connection index is only
populated for stops that are actually reached.

### 7. Object.keys/entries Optimization
**DONE** for the scan: marked stops are collected into an integer array as they are marked rather
than recovered with `Object.keys`. `Object.keys(origins)` still runs once per scan, which is
proportional to the number of origins rather than the number of stops.

### 8. GTFS Loader Stream Processing
**Files**: `GTFSLoader.ts:100-118`
- Process data in batches instead of row-by-row
- Pre-allocate arrays with estimated sizes based on dataset
**Priority**: LOW (loading/auxiliary operations)

### 9. Database Retry Logic
**Files**: `TransferPatternRepository.ts:30-42`
- Add exponential backoff instead of immediate retry
- Remove recursive approach to avoid stack overhead
**Priority**: LOW (error handling)

### 10. TypeScript Compilation Flags
**Files**: `tsconfig.json`
- Enable `skipLibCheck: true` for faster compilation
- Consider `noUnusedLocals` and `noUnusedParameters` for tree-shaking
**Priority**: LOW (build-time optimization)

## Expected Performance Impact
- **HIGH** impact: #2 (results filtering)
- **LOW** impact: #8, #9, #10 (loading/auxiliary operations)
