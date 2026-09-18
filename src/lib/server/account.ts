import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { user, userPreferences } from '@/db/schema';
import type { getDb } from '@/db';
import { parsePreferences, preferenceSchema } from '$lib/preferences';
import { RequestError } from './http';

type Database = ReturnType<typeof getDb>;
export const accountSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    preferences: preferenceSchema.optional(),
  })
  .strict()
  .refine((input) => input.name !== undefined || input.preferences !== undefined);

export async function getPreferences(db: Database, userId: string) {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  return parsePreferences(row ?? {});
}

export async function updateAccount(db: Database, userId: string, input: z.infer<typeof accountSchema>) {
  if (input.name !== undefined) {
    await db.update(user).set({ name: input.name, updatedAt: new Date() }).where(eq(user.id, userId));
  }
  if (input.preferences) {
    await db
      .insert(userPreferences)
      .values({ userId, ...input.preferences })
      .onConflictDoUpdate({ target: userPreferences.userId, set: input.preferences });
  }
  const [profile] = await db.select({ name: user.name, image: user.image }).from(user).where(eq(user.id, userId));
  return { ...profile, preferences: await getPreferences(db, userId) };
}

export const avatarMaxBytes = 2 * 1024 * 1024;

export function avatarMediaType(bytes: Uint8Array): string {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte))
    return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  throw new RequestError('Choose a PNG, JPEG, or WebP image.', 400);
}

export async function readAvatar(request: Request): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (length > avatarMaxBytes) throw new RequestError('Avatar must be smaller than 2 MB.', 413);
  if (!request.body) throw new RequestError('Choose an image first.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > avatarMaxBytes) throw new RequestError('Avatar must be smaller than 2 MB.', 413);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  avatarMediaType(bytes);
  return bytes;
}

export function avatarKey(userId: string, image: string | null): string | null {
  const match = image?.match(/^\/api\/account\/avatar\/([0-9a-f-]{36})$/);
  return match ? `avatars/${userId}/${match[1]}` : null;
}

export async function replaceAvatar(db: Database, bucket: R2Bucket, userId: string, bytes: Uint8Array | null) {
  const [profile] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
  if (!profile) throw new RequestError('Account not found', 404);
  const image = bytes ? `/api/account/avatar/${crypto.randomUUID()}` : null;
  const key = avatarKey(userId, image);
  if (key && bytes) await bucket.put(key, bytes, { httpMetadata: { contentType: avatarMediaType(bytes) } });
  try {
    const updated = await db
      .update(user)
      .set({ image, updatedAt: new Date() })
      .where(and(eq(user.id, userId), profile.image === null ? isNull(user.image) : eq(user.image, profile.image)))
      .returning({ id: user.id });
    if (!updated.length) throw new RequestError('Your avatar changed. Please try again.', 409);
  } catch (error) {
    if (key) await bucket.delete(key);
    throw error;
  }
  const previousKey = avatarKey(userId, profile.image);
  if (previousKey) await bucket.delete(previousKey).catch(() => console.error('Could not remove previous avatar'));
  return { image };
}
