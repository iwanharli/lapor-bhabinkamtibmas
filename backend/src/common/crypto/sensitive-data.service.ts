import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Enkripsi field sensitif (NIK, identitas pihak) dengan AES-256-GCM.
 * Kunci: DATA_ENCRYPTION_KEYS="k1:<base64 32 byte>,k0:<…>" — entri pertama dipakai untuk enkripsi,
 * entri lain tetap bisa mendekripsi (rotasi kunci). Format: [idLen][keyId][iv 12][tag 16][ciphertext].
 */
@Injectable()
export class SensitiveDataService {
  private readonly keys = new Map<string, Buffer>();
  private readonly activeId: string;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('DATA_ENCRYPTION_KEYS');
    for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [id, b64] = part.split(':');
      const key = Buffer.from(b64 ?? '', 'base64');
      if (!id || key.length !== 32) throw new Error('DATA_ENCRYPTION_KEYS tidak valid: tiap kunci harus "id:<base64 32 byte>"');
      this.keys.set(id, key);
    }
    this.activeId = [...this.keys.keys()][0];
  }

  encrypt(value: Record<string, unknown>): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.activeId)!, iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    const id = Buffer.from(this.activeId);
    return Buffer.concat([Buffer.from([id.length]), id, iv, cipher.getAuthTag(), ct]);
  }

  decrypt(blob: Buffer): Record<string, unknown> {
    const idLen = blob[0];
    const id = blob.subarray(1, 1 + idLen).toString();
    const key = this.keys.get(id);
    if (!key) throw new Error(`Kunci enkripsi "${id}" tidak tersedia`);
    const iv = blob.subarray(1 + idLen, 13 + idLen);
    const tag = blob.subarray(13 + idLen, 29 + idLen);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(blob.subarray(29 + idLen)), decipher.final()]).toString('utf8'));
  }
}
