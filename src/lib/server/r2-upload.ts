export class UploadSizeError extends Error {}

export async function putSizedObject(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  expectedSize: number,
  options: R2PutOptions
): Promise<number> {
  let actualSize = 0;
  const monitoredBody = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      actualSize += chunk.byteLength;
      if (actualSize > expectedSize) throw new UploadSizeError('File exceeds its declared size');
      controller.enqueue(chunk);
    }
  }));

  if (typeof FixedLengthStream === 'undefined') {
    // SvelteKit's Node-based platform proxy does not install this Workers global.
    const buffered = await new Response(monitoredBody).arrayBuffer();
    await bucket.put(key, buffered, options);
  } else {
    const fixedLengthBody = new FixedLengthStream(expectedSize);
    await Promise.all([
      monitoredBody.pipeTo(fixedLengthBody.writable),
      bucket.put(key, fixedLengthBody.readable, options)
    ]);
  }

  if (actualSize !== expectedSize) throw new UploadSizeError('File size does not match its declared size');
  return actualSize;
}
