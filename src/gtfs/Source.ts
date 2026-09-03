/**
 * Anything that can give up the bytes of a GTFS zip.
 *
 * Each environment has its own idea of what a file being read is, and the loader does not care
 * which one it was handed. A Node stream is an async iterable of chunks, so it needs no mention of
 * node:stream to be read here.
 */
export type GTFSSource =
  | Uint8Array
  | ArrayBuffer
  | Blob
  | Response
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>
  | Iterable<Uint8Array>;

/**
 * The chunks of a source, in order.
 *
 * Sources are recognised by what they can do rather than by what they are an instance of, because
 * a Blob from another realm is still a Blob and instanceof would say otherwise.
 */
export function toChunks(source: GTFSSource): AsyncIterable<Uint8Array> {
  if (ArrayBuffer.isView(source)) {
    return once(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
  }
  if (source instanceof ArrayBuffer) {
    return once(new Uint8Array(source));
  }

  const candidate = source as Partial<Response> & Partial<Blob> & Partial<ReadableStream<Uint8Array>>;

  if (typeof candidate.arrayBuffer === "function" && typeof (candidate as Response).status === "number") {
    return fromResponse(source as Response);
  }
  if (typeof candidate.stream === "function") {
    return fromReadableStream((source as Blob).stream() as ReadableStream<Uint8Array>);
  }
  if (typeof candidate.getReader === "function") {
    return fromReadableStream(source as ReadableStream<Uint8Array>);
  }
  if (typeof (source as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    return normalise(source as AsyncIterable<Uint8Array>);
  }
  if (typeof (source as Iterable<Uint8Array>)[Symbol.iterator] === "function") {
    return normalise(source as Iterable<Uint8Array>);
  }

  throw new Error("Cannot read a GTFS feed from the given source, expected bytes, a Blob, a Response, a stream or an iterable of chunks");
}

/**
 * How many bytes the source holds, where it knows, so that progress can be reported against it.
 */
export function sizeOf(source: GTFSSource): number | undefined {
  if (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) {
    return source.byteLength;
  }

  const size = (source as Blob).size;

  if (typeof size === "number") {
    return size;
  }

  const length = (source as Response).headers?.get?.("content-length");

  return length === null || length === undefined ? undefined : Number(length);
}

async function* once(chunk: Uint8Array): AsyncIterable<Uint8Array> {
  yield chunk;
}

function fromResponse(response: Response): AsyncIterable<Uint8Array> {
  if (response.body === null) {
    // a response with no body to stream still has bytes, they just all arrive at once
    return normalise((async function* () {
      yield new Uint8Array(await response.arrayBuffer());
    })());
  }

  return fromReadableStream(response.body as ReadableStream<Uint8Array>);
}

/**
 * Safari still does not give ReadableStream an async iterator, so it is read through its reader
 * rather than with for await.
 */
async function* fromReadableStream(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }
      if (value !== undefined) {
        yield toBytes(value);
      }
    }
  }
  finally {
    reader.releaseLock();
  }
}

async function* normalise(chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>): AsyncIterable<Uint8Array> {
  for await (const chunk of chunks) {
    yield toBytes(chunk);
  }
}

/**
 * A stream opened with an encoding gives strings rather than bytes, and a Node stream gives Buffers,
 * which are views onto a larger pool rather than onto just their own bytes.
 */
function toBytes(chunk: Uint8Array | string): Uint8Array {
  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  return new Uint8Array((chunk as ArrayBufferView).buffer, (chunk as ArrayBufferView).byteOffset, (chunk as ArrayBufferView).byteLength);
}
