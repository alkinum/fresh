import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { BackupManifest } from '$lib/types';

const magic = strToU8('FRESHUP1');
const backupMimeType = 'application/x-fresh-backup';
const saltLength = 16;
const ivLength = 12;
const iterations = 310_000;
const headerLength = magic.length + 4 + saltLength + ivLength;
const maxBackupBytes = 512 * 1024 * 1024;

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveKey(password: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    strToU8(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: arrayBuffer(salt), iterations: rounds },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function encryptBackup(
  manifest: BackupManifest,
  password: string,
  loadAttachment: (attachment: BackupManifest['attachments'][number]) => Promise<Uint8Array>
): Promise<Blob> {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters');

  const files: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(manifest)), { level: 6 }]
  };
  for (const attachment of manifest.attachments) {
    files[`attachments/${attachment.id}`] = [await loadAttachment(attachment), { level: 0 }];
  }

  const archive = zipSync(files);
  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const key = await deriveKey(password, salt, iterations);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: arrayBuffer(iv) },
    key,
    arrayBuffer(archive)
  ));
  const output = new Uint8Array(headerLength + encrypted.length);
  output.set(magic, 0);
  new DataView(output.buffer).setUint32(magic.length, iterations, false);
  output.set(salt, magic.length + 4);
  output.set(iv, magic.length + 4 + saltLength);
  output.set(encrypted, headerLength);
  return new Blob([output], { type: backupMimeType });
}

export async function decryptBackup(file: File | Blob, password: string): Promise<{
  manifest: BackupManifest;
  attachmentFiles: Map<string, Uint8Array>;
}> {
  if (file.size > maxBackupBytes) throw new Error('Backup exceeds the 512 MiB browser import limit');
  const payload = new Uint8Array(await file.arrayBuffer());
  if (payload.length <= headerLength || !equalBytes(payload.slice(0, magic.length), magic)) {
    throw new Error('This is not a Fresh encrypted backup');
  }

  const rounds = new DataView(payload.buffer, payload.byteOffset).getUint32(magic.length, false);
  if (rounds < 100_000 || rounds > 1_000_000) throw new Error('Backup uses unsupported encryption settings');
  const saltStart = magic.length + 4;
  const ivStart = saltStart + saltLength;
  const salt = payload.slice(saltStart, ivStart);
  const iv = payload.slice(ivStart, headerLength);
  const key = await deriveKey(password, salt, rounds);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: arrayBuffer(iv) },
      key,
      arrayBuffer(payload.slice(headerLength))
    );
  } catch {
    throw new Error('Incorrect password or damaged backup');
  }

  const files = unzipSync(new Uint8Array(decrypted));
  const manifestFile = files['manifest.json'];
  if (!manifestFile) throw new Error('Backup manifest is missing');
  const manifest = JSON.parse(strFromU8(manifestFile)) as BackupManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.attachments)) {
    throw new Error('Unsupported backup version');
  }

  const attachmentFiles = new Map<string, Uint8Array>();
  for (const attachment of manifest.attachments) {
    const data = files[`attachments/${attachment.id}`];
    if (!data || data.byteLength !== attachment.size) {
      throw new Error(`Attachment ${attachment.fileName} is missing or damaged`);
    }
    attachmentFiles.set(attachment.id, data);
  }
  return { manifest, attachmentFiles };
}
