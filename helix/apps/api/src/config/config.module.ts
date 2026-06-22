import { Global, Module } from '@nestjs/common';
import { FlagService } from './flag.service';
import { FlagsController } from './flags.controller';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
  controllers: [FlagsController, SystemSettingsController],
  providers: [FlagService, SystemSettingsService, SystemConfigService],
  exports: [FlagService, SystemSettingsService, SystemConfigService],
})
export class HelixConfigModule {}
