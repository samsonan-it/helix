import 'reflect-metadata';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionStore } from '../../src/modules/auth/session.store';
import { Role } from '@helix/types';

const mockUser = {
  id: 'user-cuid-1',
  email: 'requester@stada.dev',
  name: 'Alice Requester',
  roles: ['DemandRequester'],
  azureAdOid: null,
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock } };
  let sessionStore: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([mockUser]),
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn(),
      },
    };
    sessionStore = { create: jest.fn().mockReturnValue('session-id-abc') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionStore, useValue: sessionStore },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('getDevUsers()', () => {
    it('returns users list in development mode', async () => {
      process.env['NODE_ENV'] = 'development';
      const result = await service.getDevUsers();
      expect(result).toEqual([mockUser]);
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException when NODE_ENV !== development', async () => {
      process.env['NODE_ENV'] = 'production';
      await expect(service.getDevUsers()).rejects.toThrow(UnauthorizedException);
      process.env['NODE_ENV'] = 'development';
    });
  });

  describe('devLogin()', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
    });

    afterEach(() => {
      process.env['NODE_ENV'] = 'development';
    });

    it('creates a session entry and returns sessionId — does NOT sign a JWT', async () => {
      const result = await service.devLogin(mockUser.id);
      expect(result).toBe('session-id-abc');
      expect(sessionStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          roles: mockUser.roles,
        }),
      );
    });

    it('throws UnauthorizedException when NODE_ENV !== development', async () => {
      process.env['NODE_ENV'] = 'production';
      await expect(service.devLogin(mockUser.id)).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.devLogin('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveUserFromAadClaims()', () => {
    const validClaims = {
      oid: 'azure-oid-abc123',
      preferred_username: 'alice@stada.dev',
      name: 'Alice Requester',
    };

    const dbUser = { ...mockUser, azureAdOid: 'azure-oid-abc123' };

    it('looks up user by azureAdOid and returns AuthUser', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(dbUser);
      const result = await service.resolveUserFromAadClaims(validClaims);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { azureAdOid: 'azure-oid-abc123' } });
      expect(result).toEqual({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        roles: [Role.DemandRequester],
      });
    });

    it('throws UnauthorizedException when oid claim is absent', async () => {
      await expect(service.resolveUserFromAadClaims({ preferred_username: 'x@y.com' })).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('binds OID on first login when user provisioned by email only (azureAdOid === null)', async () => {
      const unbound = { ...mockUser, azureAdOid: null };
      const bound = { ...mockUser, azureAdOid: 'azure-oid-abc123' };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unbound);
      prisma.user.update.mockResolvedValue(bound);

      const result = await service.resolveUserFromAadClaims(validClaims);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: unbound.id },
        data: { azureAdOid: 'azure-oid-abc123' },
      });
      expect(result.id).toBe(bound.id);
    });

    it('throws ForbiddenException when email matches but OID already bound to a different value', async () => {
      const alreadyBound = { ...mockUser, azureAdOid: 'other-oid' };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(alreadyBound);

      await expect(
        service.resolveUserFromAadClaims({ oid: 'new-oid', preferred_username: 'alice@stada.dev' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when no user matches OID or email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resolveUserFromAadClaims(validClaims)).rejects.toThrow(ForbiddenException);
    });

    it('normalizes email to lowercase before DB lookup', async () => {
      const unbound = { ...mockUser, azureAdOid: null };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unbound);
      prisma.user.update.mockResolvedValue({ ...unbound, azureAdOid: 'oid-norm' });

      await service.resolveUserFromAadClaims({ oid: 'oid-norm', preferred_username: '  Alice@STADA.DEV  ' });

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: 'alice@stada.dev' } });
    });

    it('falls back to email claim when preferred_username is absent', async () => {
      const unbound = { ...mockUser, azureAdOid: null };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unbound);
      prisma.user.update.mockResolvedValue({ ...unbound, azureAdOid: 'oid-99' });

      await service.resolveUserFromAadClaims({ oid: 'oid-99', email: 'alice@stada.dev' });

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: 'alice@stada.dev' } });
    });

    it('falls back to unique_name when preferred_username and email are absent', async () => {
      const unbound = { ...mockUser, azureAdOid: null };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unbound);
      prisma.user.update.mockResolvedValue({ ...unbound, azureAdOid: 'oid-88' });

      await service.resolveUserFromAadClaims({ oid: 'oid-88', unique_name: 'alice@stada.dev' });

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: 'alice@stada.dev' } });
    });
  });
});
