import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import type { FastifyRequest } from 'fastify';
// Imported from the file itself (not from '@globe-rtc/env') because the package index validates the whole environment on import.
import { deriveInternalApiKey, INTERNAL_KEY_HEADER } from '@globe-rtc/env/dist/internal-key';
import { AppErrors } from '@/presentation/errors';

/** Only these environments may skip the key. Anything else, including an unset NODE_ENV, is treated as production. */
const RELAXED_ENVIRONMENTS = ['development', 'test'];

/**
 * Restricts a route to our own servers (the Next.js server), not to whoever can reach the API.
 *
 * It checks the `x-internal-key` header, a key derived from NEXTAUTH_SECRET (never the secret itself).
 * Where the request seems to come from (IP, Origin, Host, CORS) is deliberately NOT used: the web app proxies
 * `/backend/*` to this API, so a request from the internet reaches the API *from the Next.js server*, and
 * Origin/Host are plain headers that any non-browser client can set to anything. CORS is enforced by browsers only.
 *
 * - production (or any environment that is not development/test): the header is required and must match.
 * - development/test: the header may be omitted (Swagger, Bruno and curl keep working), but if it is sent it must match.
 * - NEXTAUTH_SECRET missing: production refuses every request (fail closed); development lets requests through.
 */
@Injectable()
export class InternalOnlyGuard implements CanActivate {
  private readonly logger = new Logger(InternalOnlyGuard.name);
  private warnedOpen = false;

  canActivate(context: ExecutionContext): boolean {
    const relaxed = RELAXED_ENVIRONMENTS.includes(process.env.NODE_ENV ?? '');
    const secret = process.env.NEXTAUTH_SECRET;

    if (!secret) {
      if (!relaxed) {
        this.logger.error('NEXTAUTH_SECRET is not set: refusing internal-only routes');
        throw AppErrors.forbidden('Acesso restrito ao servidor da aplicação');
      }
      if (!this.warnedOpen) {
        this.warnedOpen = true;
        this.logger.warn('NEXTAUTH_SECRET is not set: internal-only routes are open (allowed outside production)');
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers[INTERNAL_KEY_HEADER];
    const provided = typeof header === 'string' && header !== '' ? header : undefined;

    if (provided === undefined) {
      if (relaxed) return true;
      throw AppErrors.forbidden('Acesso restrito ao servidor da aplicação');
    }

    if (!safeEqual(provided, deriveInternalApiKey(secret))) {
      throw AppErrors.forbidden('Acesso restrito ao servidor da aplicação');
    }
    return true;
  }
}

/** Constant-time comparison; hashing first makes both buffers the same length. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
