import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

@Global()
@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService, SessionStore],
  exports: [AuthService, SessionStore],
})
export class AuthModule {}
