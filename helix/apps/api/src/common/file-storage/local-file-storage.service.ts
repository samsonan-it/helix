import * as fs from 'fs';
import * as path from 'path';
import { IFileStorageService } from './file-storage.interface';

export class LocalFileStorageService implements IFileStorageService {
  private readonly baseDir = 'uploads';

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const dest = path.join(this.baseDir, key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
    return dest;
  }

  async delete(key: string): Promise<void> {
    await fs.promises.unlink(key).catch(() => {});
  }
}
