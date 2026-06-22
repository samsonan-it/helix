import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { Role } from '@helix/types';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

function createContext(user: { roles: Role[] }, handlerRoles: Role[] | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('passes when user has the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DemandRequester]);
    const ctx = createContext({ roles: [Role.DemandRequester] }, [Role.DemandRequester]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when user lacks the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.PortfolioManager]);
    const ctx = createContext({ roles: [Role.DemandRequester] }, [Role.PortfolioManager]);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('passes when no @Roles() metadata is set (unguarded route)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createContext({ roles: [] }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user has one of multiple required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      Role.DemandManager,
      Role.PortfolioManager,
    ]);
    const ctx = createContext({ roles: [Role.PortfolioManager] }, [Role.DemandManager, Role.PortfolioManager]);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
