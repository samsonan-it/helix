import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@helix/types';

const COOKIE_NAME = 'helix-session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env['NODE_ENV'] === 'production',
  path: '/',
};

function parseIdTokenClaims(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionStore: SessionStore,
  ) {}

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(COOKIE_NAME)
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('dev-users')
  @ApiOperation({ summary: 'List dev seed users (dev mode only)' })
  getDevUsers() {
    if (process.env['NODE_ENV'] === 'production') {
      throw new UnauthorizedException();
    }
    return this.authService.getDevUsers();
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Create session for a dev seed user (dev mode only)' })
  async devLogin(
    @Body() body: { userId: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (process.env['NODE_ENV'] === 'production' || process.env['AZURE_AD_CLIENT_SECRET']) {
      throw new UnauthorizedException();
    }
    const sessionId = await this.authService.devLogin(body.userId);
    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
  }

  @Get('azure')
  @ApiOperation({ summary: 'Initiate AAD OAuth2 authorization code flow' })
  azureLogin(@Res() res: Response): void {
    if (!process.env['AZURE_AD_CLIENT_SECRET']) {
      throw new ServiceUnavailableException('AAD authentication is not configured in this environment');
    }
    const tenantId = process.env['AZURE_AD_TENANT_ID']!;
    const clientId = process.env['AZURE_AD_CLIENT_ID']!;
    const redirectUri = process.env['AZURE_AD_REDIRECT_URI']!;
    const state = this.sessionStore.createState();
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
    });
    res.redirect(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`);
  }

  @Get('azure/callback')
  @ApiOperation({ summary: 'AAD OAuth2 callback — exchanges code for session cookie' })
  async azureCallback(
    @Req() req: Request & { query: Record<string, string> },
    @Res() res: Response,
  ): Promise<void> {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:8080';

    if (error) {
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!state || !this.sessionStore.validateAndConsumeState(state)) {
      res.redirect(`${frontendUrl}/login?error=invalid_state`);
      return;
    }

    if (!code) {
      res.redirect(`${frontendUrl}/login?error=missing_code`);
      return;
    }

    const tenantId = process.env['AZURE_AD_TENANT_ID']!;
    const clientId = process.env['AZURE_AD_CLIENT_ID']!;
    const clientSecret = process.env['AZURE_AD_CLIENT_SECRET']!;
    const redirectUri = process.env['AZURE_AD_REDIRECT_URI']!;

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'openid profile email',
        }).toString(),
      },
    );

    if (!tokenResponse.ok) {
      res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
      return;
    }

    const tokens = (await tokenResponse.json()) as { id_token?: string };
    const claims = parseIdTokenClaims(tokens.id_token ?? '');

    const claimEmail = ((claims['preferred_username'] || claims['email'] || claims['unique_name']) as string | undefined)
      ?.toLowerCase()
      .trim();

    let user;
    try {
      user = await this.authService.resolveUserFromAadClaims(claims);
    } catch {
      const params = new URLSearchParams({ error: 'auth_failed' });
      if (claimEmail) params.set('email', claimEmail);
      res.redirect(`${frontendUrl}/login?${params.toString()}`);
      return;
    }

    const sessionId = this.sessionStore.create(user);
    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
    res.redirect(process.env['FRONTEND_URL'] ?? 'http://localhost:8080');
  }

  @Get('logout')
  @ApiOperation({ summary: 'Destroy session and clear cookie' })
  logout(
    @Req() req: Request & { cookies: Record<string, string> },
    @Res() res: Response,
  ): void {
    const sessionId = req.cookies?.[COOKIE_NAME];
    if (sessionId) {
      this.sessionStore.delete(sessionId);
    }
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:8080';
    res.redirect(`${frontendUrl}/login`);
  }

  @Post('session/extend')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(COOKIE_NAME)
  @ApiOperation({ summary: 'Reset session lastActiveAt to now' })
  extendSession(
    @Req() req: Request & { cookies: Record<string, string> },
  ): void {
    const sessionId = req.cookies?.[COOKIE_NAME];
    if (sessionId) {
      this.sessionStore.extend(sessionId);
    }
  }
}
