# Performance Optimization TODO

## Low-Level Optimizations

### 1. Object Initialization Pre-allocation
**Files**: `RaptorAlgorithm.ts:42-68`, `QueueFactory.ts:18-28`
- Replace `{}` with pre-sized Maps or objects with known keys
- Pre-allocate `queue` in QueueFactory with expected size
- Cache array lengths in loops
**Priority**: HIGH (hot path optimization)

### 2. Array Method Chain Optimization
**Files**: `RangeQuery.ts:48`, `GroupStationDepartAfterQuery.ts:88-93`, `MultipleCriteriaFilter.ts:29,46`
- Replace `Math.min(...newResults.map(j => j.departureTime))` with single-pass loop
- Replace `flatMap` chains with for-loops to reduce intermediate arrays
- Replace `.filter()` with traditional loops for hot paths
**Priority**: HIGH (hot path optimization)

### 3. Object Property Access Optimization
**Files**: `RaptorAlgorithm.ts:50-66`, `RouteScanner.ts:27-46`
- Cache repeated property accesses (`trip.stopTimes[pi]`, `this.routePath[routeId]`)
- Store array lengths before loops instead of accessing `.length` repeatedly
**Priority**: HIGH (core algorithm performance)

### 4. hasOwnProperty Optimization
**Files**: `RouteScanner.ts:20`, `Service.ts:14`
- Replace `hasOwnProperty` with `in` operator or direct property checks
- Consider using Map instead of objects for frequently checked indices
**Priority**: MEDIUM (frequent operations)

### 5. String Operations
**Files**: `RaptorAlgorithmFactory.ts:80`
- Cache the route ID string computation (`.map().join()` is expensive)
- Consider numeric route IDs instead of strings
**Priority**: MEDIUM (frequent operations)

### 6. ScanResults Initialization
**Files**: `ScanResultsFactory.ts:11-23`
- Replace loop-based initialization with Object.fromEntries or bulk operations
- Use typed arrays for numeric data (bestArrivals, kArrivals)
**Priority**: HIGH (initialization hot path)

### 7. Object.keys/entries Optimization
**Files**: `RaptorAlgorithm.ts:28,36,45`, `ScanResults.ts:42`
- Replace `Object.keys(origins)` with pre-computed arrays where possible
- Cache keys that don't change between iterations
**Priority**: MEDIUM (frequent operations)

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
- **HIGH** impact: #1, #2, #3, #6 (core algorithm hot paths)
- **MEDIUM** impact: #4, #5, #7 (frequent operations)
- **LOW** impact: #8, #9, #10 (loading/auxiliary operations)
