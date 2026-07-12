import { HttpApiMiddleware, HttpApiSecurity } from 'effect/unstable/httpapi'

import {
  ServiceUnavailableErrorSchema,
  UnauthorizedErrorSchema,
} from './errors'

export class RegistryAuthorization extends HttpApiMiddleware.Service<RegistryAuthorization>()(
  '@cv/application-registry-api-contract/RegistryAuthorization',
  {
    error: [UnauthorizedErrorSchema, ServiceUnavailableErrorSchema],
    security: { bearer: HttpApiSecurity.bearer },
  }
) {}
