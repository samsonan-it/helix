import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DemandStatus, VALID_TRANSITIONS } from '@helix/shared';

@Injectable()
export class DemandWorkflowService {
  async transition(
    _tx: Prisma.TransactionClient,
    demand: { id: string; status: string },
    to: DemandStatus,
    _actorId: string,
  ): Promise<void> {
    const from = demand.status as DemandStatus;
    const allowed = VALID_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition demand from ${from} to ${to}`,
      );
    }
  }
}
