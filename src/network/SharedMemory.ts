/**
 * Allocation for the arrays a timetable is made of.
 *
 * Nothing in Timetable is an object, so a timetable built over SharedArrayBuffers can be posted to
 * a worker and arrive as views over the same bytes rather than as a copy. A national feed is tens
 * of megabytes of stop times, and a pool of workers would otherwise hold one copy each.
 *
 * SharedArrayBuffer is only available to a cross origin isolated document, so where it is missing
 * these are ordinary arrays and posting a timetable copies it, as it always did.
 */
export const canShareMemory = typeof SharedArrayBuffer !== "undefined";

function allocate(bytes: number): ArrayBufferLike {
  return canShareMemory ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
}

export function sharedInt32Array(length: number): Int32Array {
  return new Int32Array(allocate(length * Int32Array.BYTES_PER_ELEMENT));
}

export function sharedUint8Array(length: number): Uint8Array {
  return new Uint8Array(allocate(length * Uint8Array.BYTES_PER_ELEMENT));
}
