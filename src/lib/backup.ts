import {
  strFromU8,
  strToU8,
  unzip,
  unzipSync,
  zip,
  type Unzipped,
  type UnzipFileInfo,
  type Zippable
} from 'fflate';
import {
  backupManifestByteLength,
  backupManifestSchema,
  MAX_BACKUP_ATTACHMENTS,
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_MANIFEST_BYTES
} from '$lib/backup-schema';
import type { BackupManifest } from '$lib/types';

const magic = strToU8('FRESHUP1');
const backupMimeType = 'application/x-fresh-backup';
const saltLength = 16;
const ivLength = 12;
const iterations = 310_000;
const headerLength = magic.length + 4 + saltLength + ivLength;
const authenticationTagLength = 16;
const maxAttachmentBytes = 95 * 1024 * 1024;

export const MAX_BACKUP_ARCHIVE_BYTES = MAX_BACKUP_FILE_BYTES - headerLength - authenticationTagLength;

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

function createArchive(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, (error, archive) => {
      if (error) reject(error);
      else resolve(archive);
    });
  });
}

function inspectArchive(archive: Uint8Array): Set<string> {
  const names = new Set<string>();
  let totalBytes = 0;
  let attachmentCount = 0;

  unzipSync(archive, {
    filter(file: UnzipFileInfo) {
      if (names.has(file.name)) throw new Error('Backup contains duplicate archive entries');
      names.add(file.name);
      if (file.compression !== 0 && file.compression !== 8) {
        throw new Error('Backup uses an unsupported compression method');
      }

      if (file.name === 'manifest.json') {
        if (file.originalSize > MAX_BACKUP_MANIFEST_BYTES) {
          throw new Error('Backup manifest exceeds the 10 MiB import limit');
        }
      } else if (file.name.startsWith('attachments/') && file.name.length > 'attachments/'.length) {
        attachmentCount += 1;
        if (attachmentCount > MAX_BACKUP_ATTACHMENTS) throw new Error('Backup contains too many attachments');
        if (file.originalSize > maxAttachmentBytes) throw new Error('Backup contains an oversized attachment');
      } else {
        throw new Error('Backup contains an unsupported archive entry');
      }

      totalBytes += file.originalSize;
      if (totalBytes > MAX_BACKUP_FILE_BYTES) {
        throw new Error('Backup expands beyond the 512 MiB browser import limit');
      }
      return false;
    }
  });
  return names;
}

function extractArchive(archive: Uint8Array): Promise<Unzipped> {
  const names = inspectArchive(archive);
  return new Promise((resolve, reject) => {
    unzip(archive, { filter: (file) => names.has(file.name) }, (error, files) => {
      if (error) reject(error);
      else resolve(files);
    });
  });
}

export async function encryptBackup(
  manifest: BackupManifest,
  password: string,
  loadAttachment: (attachment: BackupManifest['attachments'][number]) => Promise<Uint8Array>
): Promise<Blob> {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters');
  const parsedManifest = backupManifestSchema.parse(manifest);
  if (backupManifestByteLength(parsedManifest) > MAX_BACKUP_MANIFEST_BYTES) {
    throw new Error('Backup manifest exceeds the 10 MiB export limit');
  }

  const files: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(parsedManifest)), { level: 6 }]
  };
  for (const attachment of parsedManifest.attachments) {
    const data = await loadAttachment(attachment);
    if (data.byteLength !== attachment.size) {
      throw new Error(`Attachment ${attachment.fileName} changed while the backup was being exported`);
    }
    files[`attachments/${attachment.id}`] = [data, { level: 0 }];
  }

  const archive = await createArchive(files);
  if (archive.byteLength > MAX_BACKUP_ARCHIVE_BYTES) {
    throw new Error('Backup exceeds the 512 MiB browser file limit');
  }
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
  if (output.byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new Error('Backup exceeds the 512 MiB browser file limit');
  }
  return new Blob([output], { type: backupMimeType });
}

export async function decryptBackup(file: File | Blob, password: string): Promise<{
  manifest: BackupManifest;
  attachmentFiles: Map<string, Uint8Array>;
}> {
  if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup exceeds the 512 MiB browser import limit');
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

  let files: Unzipped;
  try {
    files = await extractArchive(new Uint8Array(decrypted));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Backup ')) throw error;
    throw new Error('Backup archive is damaged or unsupported', { cause: error });
  }
  const manifestFile = files['manifest.json'];
  if (!manifestFile) throw new Error('Backup manifest is missing');
  if (manifestFile.byteLength > MAX_BACKUP_MANIFEST_BYTES) {
    throw new Error('Backup manifest exceeds the 10 MiB import limit');
  }

  let manifest: BackupManifest;
  try {
    manifest = backupManifestSchema.parse(JSON.parse(strFromU8(manifestFile)));
  } catch {
    throw new Error('Backup manifest is invalid or unsupported');
  }

  const attachmentFiles = new Map<string, Uint8Array>();
  const expectedEntries = new Set(['manifest.json']);
  for (const attachment of manifest.attachments) {
    const entryName = `attachments/${attachment.id}`;
    expectedEntries.add(entryName);
    const data = files[entryName];
    if (!data || data.byteLength !== attachment.size) {
      throw new Error(`Attachment ${attachment.fileName} is missing or damaged`);
    }
    attachmentFiles.set(attachment.id, data);
  }
  if (Object.keys(files).some((name) => !expectedEntries.has(name))) {
    throw new Error('Backup contains attachments that are not present in its manifest');
  }
  return { manifest, attachmentFiles };
}
