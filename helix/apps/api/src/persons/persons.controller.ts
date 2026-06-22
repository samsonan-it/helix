import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { PersonResponse } from '@helix/shared';

@ApiTags('persons')
@ApiCookieAuth('helix-session')
@Controller('persons')
@UseGuards(SessionAuthGuard)
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  @ApiOperation({ summary: 'List demand managers, optionally filtered by area and country' })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'countryId', required: false })
  @ApiQuery({ name: 'globalScope', required: false })
  findAll(
    @Query('areaId') areaId?: string,
    @Query('countryId') countryId?: string,
    @Query('globalScope') globalScope?: string,
  ): Promise<PersonResponse[]> {
    return this.personsService.findDemandManagers(areaId, countryId, globalScope === 'true');
  }

  @Get('business-controllers')
  @ApiOperation({ summary: 'List business controllers, optionally filtered by area and country' })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'countryId', required: false })
  @ApiQuery({ name: 'globalScope', required: false })
  findBusinessControllers(
    @Query('areaId') areaId?: string,
    @Query('countryId') countryId?: string,
    @Query('globalScope') globalScope?: string,
  ): Promise<PersonResponse[]> {
    return this.personsService.findBusinessControllers(areaId, countryId, globalScope === 'true');
  }
}
