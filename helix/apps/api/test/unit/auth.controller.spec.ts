import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { SessionStore } from '../../src/modules/auth/session.store';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { AuthUser, Role } from '@helix/types';

const mockUsers = [
  { id: 'id-1', name: 'Alice Requester', email: 'requester@stada.dev', roles: ['DemandRequester'] },
];

const mockAuthUser: AuthUser = {
  id: 'id-1',
  name: 'Alice Requester',
  email: 'requester@stada.dev',
  roles: [Role.DemandRequester],
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { getDevUsers: jest.Mock; devLogin: jest.Mock };
  let sessionStore: { create: jest.Mock; get: jest.Mock; delete: jest.Mock; extend: jest.Mock; createState: jest.Mock; validateAndConsumeState: jest.Mock };

  beforeEach(async () => {
    authService = {
      getDevUsers: jest.fn().mockResolvedValue(mockUsers),
      devLogin: jest.fn().mockResolvedValue('session-id-abc'),
    };
    sessionStore = {
      create: jest.fn().mockReturnValue('session-id-abc'),
      get: jest.fn(),
      delete: jest.fn(),
      extend: jest.fn(),
      createState: jest.fn().mockReturnValue('state-token-xyz'),
      validateAndConsumeState: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionStore, useValue: sessionStore },
        SessionAuthGuard,
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
  });

  describe('GET /auth/dev-users', () => {
    it('returns list of dev users in dev mode', async () => {
      const result = await controller.getDevUsers();
      expect(result).toEqual(mockUsers);
      expect(authService.getDevUsers).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException in production mode', () => {
      const saved = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        expect(() => controller.getDevUsers()).toThrow(UnauthorizedException);
        expect(authService.getDevUsers).not.toHaveBeenCalled();
      } finally {
        process.env['NODE_ENV'] = saved;
      }
    });
  });

  describe('POST /auth/dev-login', () => {
    it('calls authService.devLogin, sets cookie, returns 204 (no body)', async () => {
      const savedSecret = process.env['AZURE_AD_CLIENT_SECRET'];
      delete process.env['AZURE_AD_CLIENT_SECRET'];
      const res = { cookie: jest.fn() } as unknown as import('express').Response;
      try {
      await controller.devLogin({ userId: 'id-1' }, res);
      expect(authService.devLogin).toHaveBeenCalledWith('id-1');
      expect(res.cookie).toHaveBeenCalledWith(
        'helix-session',
        'session-id-abc',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
      );
      } finally {
        if (savedSecret !== undefined) process.env['AZURE_AD_CLIENT_SECRET'] = savedSecret;
      }
    });

    it('throws UnauthorizedException in production mode', async () => {
      const saved = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      const res = { cookie: jest.fn() } as unknown as import('express').Response;
      try {
        await expect(controller.devLogin({ userId: 'id-1' }, res)).rejects.toThrow(UnauthorizedException);
        expect(authService.devLogin).not.toHaveBeenCalled();
      } finally {
        process.env['NODE_ENV'] = saved;
      }
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user passed via @CurrentUser()', () => {
      const result = controller.getMe(mockAuthUser);
      expect(result).toEqual(mockAuthUser);
    });
  });

  describe('GET /auth/logout', () => {
    it('deletes session, clears cookie, redirects to /login in dev mode', () => {
      const req = { cookies: { 'helix-session': 'session-id-abc' } } as unknown as import('express').Request & { cookies: Record<string, string> };
      const res = { clearCookie: jest.fn(), redirect: jest.fn() } as unknown as import('express').Response;
      const saved = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      try {
        controller.logout(req, res);
        expect(sessionStore.delete).toHaveBeenCalledWith('session-id-abc');
        expect(res.clearCookie).toHaveBeenCalledWith('helix-session', { httpOnly: true, sameSite: 'strict', secure: false, path: '/' });
        expect(res.redirect).toHaveBeenCalledWith(`${process.env['FRONTEND_URL'] ?? 'http://localhost:8080'}/login`);
      } finally {
        process.env['NODE_ENV'] = saved;
      }
    });

    it('handles missing session cookie gracefully', () => {
      const req = { cookies: {} } as unknown as import('express').Request & { cookies: Record<string, string> };
      const res = { clearCookie: jest.fn(), redirect: jest.fn() } as unknown as import('express').Response;
      controller.logout(req, res);
      expect(sessionStore.delete).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/session/extend', () => {
    it('calls sessionStore.extend with the sessionId from cookie and returns void', () => {
      const req = { cookies: { 'helix-session': 'session-id-abc' } } as unknown as import('express').Request & { cookies: Record<string, string> };
      controller.extendSession(req);
      expect(sessionStore.extend).toHaveBeenCalledWith('session-id-abc');
    });
  });
});
