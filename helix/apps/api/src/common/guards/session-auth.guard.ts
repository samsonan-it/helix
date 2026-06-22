import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SessionStore } from '../../modules/auth/session.store';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionStore: SessionStore) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { cookies: Record<string, string>; user: unknown }>();
    const sessionId = request.cookies?.['helix-session'];

    if (!sessionId) {
      throw new UnauthorizedException();
    }

    const entry = this.sessionStore.get(sessionId);
    if (!entry) {
      throw new UnauthorizedException();
    }

    request.user = entry.user;
    return true;
  }
}
