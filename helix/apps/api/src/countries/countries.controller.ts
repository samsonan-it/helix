import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountriesService } from './countries.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CountryResponse } from '@helix/shared';

@ApiTags('countries')
@ApiCookieAuth('helix-session')
@Controller('countries')
@UseGuards(SessionAuthGuard)
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active countries' })
  findAll(): Promise<CountryResponse[]> {
    return this.countriesService.listActive();
  }
}
