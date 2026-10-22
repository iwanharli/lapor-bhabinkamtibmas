import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';

/**
 * Penyimpanan file lampiran. Driver `local` (default) menulis ke folder di disk server;
 * kunci objek berupa path relatif, mis. `reports/2026/10/<uuid>.jpg`.
 */
@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(config: ConfigService) {
    this.root = resolve(config.get('STORAGE_LOCAL_DIR', './storage'));
  }

  /** Path absolut yang dijamin tetap di dalam root (mencegah path traversal). */
  private pathOf(key: string) {
    const p = resolve(this.root, normalize(key));
    if (p !== this.root && !p.startsWith(this.root + sep)) throw new Error(`Kunci objek tidak valid: ${key}`);
    return p;
  }

  async put(key: string, data: Buffer) {
    const p = this.pathOf(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data, { mode: 0o640 });
  }

  async exists(key: string) {
    try {
      return (await stat(this.pathOf(key))).isFile();
    } catch {
      return false;
    }
  }

  read(key: string): ReadStream {
    return createReadStream(this.pathOf(key));
  }

  async remove(key: string) {
    await rm(this.pathOf(key), { force: true }).catch((e) => this.logger.warn(`Gagal menghapus ${key}: ${e}`));
  }

  static key(...parts: string[]) {
    return join(...parts).split(sep).join('/');
  }
}
