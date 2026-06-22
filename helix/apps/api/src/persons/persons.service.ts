import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonResponse } from '@helix/shared';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findByRole(role: string, areaId?: string, countryId?: string, globalScope?: boolean): Promise<PersonResponse[]> {
    const whereArea = areaId
      ? {
          OR: [
            {
              areaIds: { isEmpty: true },
              ...(globalScope ? { countryIds: { isEmpty: true } } : {}),
            },
            {
              areaIds: { has: areaId },
              // countryId: filter by specific country; globalScope: require globally-scoped assignment; otherwise omit for pre-population UX
              ...(countryId
                ? { OR: [{ countryIds: { isEmpty: true } }, { countryIds: { has: countryId } }] }
                : globalScope
                  ? { countryIds: { isEmpty: true } }
                  : {}),
            },
          ],
        }
      : {};

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { role, ...whereArea },
      include: { user: { select: { id: true, email: true, name: true, status: true } } },
    });

    const seen = new Set<string>();
    return assignments
      .filter(a => a.user.status === 'active' && !seen.has(a.user.id) && seen.add(a.user.id))
      .map(a => ({ id: a.user.id, email: a.user.email, name: a.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  findDemandManagers(areaId?: string, countryId?: string, globalScope?: boolean): Promise<PersonResponse[]> {
    return this.findByRole('DemandManager', areaId, countryId, globalScope);
  }

  findBusinessControllers(areaId?: string, countryId?: string, globalScope?: boolean): Promise<PersonResponse[]> {
    return this.findByRole('BusinessController', areaId, countryId, globalScope);
  }
}
