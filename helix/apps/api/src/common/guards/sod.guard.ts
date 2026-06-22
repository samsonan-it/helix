import { CanActivate, Injectable } from '@nestjs/common';

// TODO: BR-12 SoD enforcement wired in Epic 3
@Injectable()
export class SodGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
