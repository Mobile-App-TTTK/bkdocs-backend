import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err, user, info, context, status) {
    
    console.log('[GUARD] err =', err?.message);
    console.log('[GUARD] info =', info?.message || info);
    console.log('[GUARD] user =', user);
    return super.handleRequest(err, user, info, context, status);
  }
}
