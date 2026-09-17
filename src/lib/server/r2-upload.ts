export class UploadSizeError extends Error {}

export async function putSizedObject(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  expectedSize: number,
  options: R2PutOptions
): Promise<R2Object | null> {
  let actualSize = 0;
  const monitoredBody = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      actualSize += chunk.byteLength;
      if (actualSize > expectedSize) throw new UploadSizeError('File exceeds its declared size');
      controller.enqueue(chunk);
    },
    flush() {
      if (actualSize !== expectedSize) throw new UploadSizeError('File size does not match its declared size');
    }
  }));

  if (typeof FixedLengthStream === 'undefined') {
    // SvelteKit's Node-based platform proxy does not install this Workers global.
    const buffered = await new Response(monitoredBody).arrayBuffer();
    return bucket.put(key, buffered, options);
  }

  const fixedLengthBody = new FixedLengthStream(expectedSize);
  const controller = new AbortController();
  const [stream, stored] = await Promise.allSettled([
    monitoredBody.pipeTo(fixedLengthBody.writable, { signal: controller.signal }),
    bucket.put(key, fixedLengthBody.readable, options).then((object) => {
      // A failed conditional write may return before consuming the request stream.
      if (object === null) controller.abort();
      return object;
    }, (error: unknown) => {
      controller.abort();
      throw error;
    })
  ]);
  if (stored.status === 'fulfilled' && stored.value === null) return null;
  if (stream.status === 'rejected' && stream.reason instanceof UploadSizeError) throw stream.reason;
  if (stored.status === 'rejected') throw stored.reason;
  if (stream.status === 'rejected') throw stream.reason;
  return stored.value;
}
