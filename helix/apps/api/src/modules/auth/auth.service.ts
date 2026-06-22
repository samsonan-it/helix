import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStore } from './session.store';
import { AuthUser, Role } from '@helix/types';

interface AadIdTokenClaims {
  oid?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  unique_name?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionStore: SessionStore,
  ) {}

  async getDevUsers(): Promise<{ id: string; name: string; email: string; roles: string[] }[]> {
    if (process.env['NODE_ENV'] !== 'development') {
      throw new UnauthorizedException('Dev auth is not available outside development');
    }
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, roles: true },
    });
  }

  async devLogin(userId: string): Promise<string> {
    if (process.env['NODE_ENV'] !== 'development') {
      throw new UnauthorizedException('Dev auth is not available outside development');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles as Role[],
    };
    return this.sessionStore.create(authUser);
  }

  async resolveUserFromAadClaims(claims: AadIdTokenClaims): Promise<AuthUser> {
    if (!claims.oid) {
      this.logger.warn('AAD callback rejected: missing oid claim');
      throw new UnauthorizedException('Token missing required oid claim');
    }

    const claimEmail = (claims.preferred_username || claims.email || claims.unique_name)
      ?.toLowerCase()
      .trim();

    let user = await this.prisma.user.findUnique({ where: { azureAdOid: claims.oid } });

    if (!user) {
      if (claimEmail) {
        user = await this.prisma.user.findUnique({ where: { email: claimEmail } });
        if (user && user.azureAdOid === null) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { azureAdOid: claims.oid },
          });
          this.logger.log(`OID bound: userId=${user.id} email=${user.email} oid=${claims.oid}`);
        } else if (user) {
          user = null;
        }
      }
    }

    if (!user) {
      this.logger.warn(`User not provisioned: oid=${claims.oid} email=${claimEmail ?? 'unknown'} — returning 403`);
      const identity = claimEmail ? ` (${claimEmail})` : '';
      throw new ForbiddenException(
        `Your account${identity} is not provisioned in Helix. Contact your system administrator.`,
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles as Role[],
    };
  }
}
