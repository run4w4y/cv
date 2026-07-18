import { WorkerEntrypoint } from 'cloudflare:workers'

import type { ApplicationRegistryEnv } from '../worker/types'
import { handleCvPublicResolverRequest } from './cv-public-resolver'

/**
 * Named service-binding entrypoint. It is deliberately separate from the
 * registry Worker's public fetch handler, so it cannot be reached through a
 * public route and does not need a management bearer token.
 */
export class CvPublicResolver extends WorkerEntrypoint<ApplicationRegistryEnv> {
  override fetch(request: Request): Promise<Response> {
    return handleCvPublicResolverRequest(request, this.env)
  }
}
