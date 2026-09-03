import { Unzip, UnzipInflate } from "fflate";

/**
 * An entry of the zip, offered before any of it has been decompressed.
 */
export interface ZipEntry {
  /** The name the zip gives it, directories and all */
  name: string;
  /**
   * Uncompressed size. Absent for a zip written as a stream, which defers the sizes until after
   * each entry's data rather than declaring them in front of it.
   */
  originalSize?: number;
  /** Compressed size, absent for the same reason */
  compressedSize?: number;
}

/**
 * Receives the text of one entry as it decompresses.
 */
export type EntrySink = (text: string, final: boolean) => void;

export interface ReadZipOptions {
  /** Called as the zip's own bytes are consumed, which is how far the download has got */
  onBytes?: (bytesRead: number) => void;
  /** Called as an entry decompresses, which is how far through the big file in a feed we are */
  onEntryBytes?: (entry: ZipEntry, bytesRead: number) => void;
}

/**
 * Reads a zip as it arrives, handing each entry's text to whoever wants it.
 *
 * The entries are read in the order the zip stores them and decompressed as the bytes turn up, so a
 * feed can be parsed while it is still downloading rather than after it has finished.
 *
 * `open` decides what to do with an entry before it is decompressed. Returning undefined skips it
 * entirely, which is worth doing: a feed's routes.txt and agency.txt are of no interest here, and
 * not inflating them is the cheapest way to read them.
 */
export function readZip(
  chunks: AsyncIterable<Uint8Array>,
  open: (entry: ZipEntry) => EntrySink | undefined,
  options: ReadZipOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = new Unzip();

    // the synchronous inflater, so entries arrive whole and in order. The async one runs each entry
    // in a worker of its own and lets them finish out of order, and a trip's calls are ordered by
    // the order of the rows, so the file order is not ours to lose
    unzip.register(UnzipInflate);

    unzip.onfile = file => {
      const entry: ZipEntry = {
        name: file.name,
        originalSize: file.originalSize,
        compressedSize: file.size
      };

      const sink = open(entry);

      if (sink === undefined) {
        return;
      }

      // one decoder per entry, so a multi byte character split across two chunks is held over
      // within the file it belongs to and never leaks into the next one
      const decoder = new TextDecoder();
      let read = 0;

      file.ondata = (err, data, final) => {
        if (err) {
          throw err;
        }

        read += data.length;

        sink(decoder.decode(data, { stream: !final }), final);
        options.onEntryBytes?.(entry, read);
      };

      // has to be started here, synchronously: an entry that is not started has its compressed
      // bytes held until the whole zip has been read
      file.start();
    };

    (async () => {
      let bytesRead = 0;

      for await (const chunk of chunks) {
        unzip.push(chunk);

        bytesRead += chunk.length;
        options.onBytes?.(bytesRead);
      }

      unzip.push(new Uint8Array(0), true);
    })().then(resolve, reject);
  });
}
