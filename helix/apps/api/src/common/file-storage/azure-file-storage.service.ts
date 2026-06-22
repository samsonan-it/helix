import { BlobServiceClient } from '@azure/storage-blob';
import { IFileStorageService } from './file-storage.interface';

export class AzureFileStorageService implements IFileStorageService {
  private readonly containerClient;

  constructor(accountName: string, containerName: string, sasToken: string) {
    const client = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net?${sasToken}`,
    );
    this.containerClient = client.getContainerClient(containerName);
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const blob = this.containerClient.getBlockBlobClient(key);
    await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimeType } });
    return key;
  }

  async delete(key: string): Promise<void> {
    await this.containerClient.getBlockBlobClient(key).deleteIfExists();
  }
}
