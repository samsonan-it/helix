export const FILE_STORAGE_SERVICE = Symbol('FILE_STORAGE_SERVICE');

export interface IFileStorageService {
  /** Store buffer; return an opaque storage key (path or blob name). */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  /** Delete by the key previously returned from upload(); swallow not-found. */
  delete(key: string): Promise<void>;
}
