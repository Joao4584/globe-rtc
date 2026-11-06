import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiHeader } from '@nestjs/swagger';
import { INTERNAL_KEY_HEADER } from '@globe-rtc/env/dist/internal-key';
import { InternalOnlyGuard } from '@/presentation/guards/internal-only.guard';

/**
 * Marks a route (or a whole controller) as callable only by our own servers.
 * Put it on any route that must not be reachable from the internet, e.g. `@Post() @InternalOnly()`.
 * See `InternalOnlyGuard` for how the check works.
 */
export const InternalOnly = () =>
  applyDecorators(
    UseGuards(InternalOnlyGuard),
    ApiHeader({
      name: INTERNAL_KEY_HEADER,
      required: false,
      description:
        'Key derived from NEXTAUTH_SECRET (deriveInternalApiKey in @globe-rtc/env). Required in production; optional in development.',
    }),
    ApiForbiddenResponse({ description: 'Missing or wrong x-internal-key' }),
  );
