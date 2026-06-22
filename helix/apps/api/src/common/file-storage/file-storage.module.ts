import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FILE_STORAGE_SERVICE } from './file-storage.interface';
import { LocalFileStorageService } from './local-file-storage.service';
import { AzureFileStorageService } from './azure-file-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FILE_STORAGE_SERVICE,
      useFactory: (config: ConfigService) => {
        const account   = config.get<string>('AZURE_STORAGE_ACCOUNT_NAME');
        const container = config.get<string>('AZURE_STORAGE_CONTAINER_NAME');
        const sas       = config.get<string>('AZURE_STORAGE_SAS_TOKEN');
        if (account && container && sas) {
          return new AzureFileStorageService(account, container, sas);
        }
        return new LocalFileStorageService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [FILE_STORAGE_SERVICE],
})
export class FileStorageModule {}
