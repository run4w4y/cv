import { applicationRegistryWebHandler } from './http/runtime'
import {
  listingChecksAreEnabled,
  runScheduledListingChecks,
} from './scheduled/listing-checks'
import { makeWorkerRequestContext } from './worker/bindings'
import type {
  ApplicationRegistryEnv,
  WorkerExecutionContext,
  WorkerScheduledController,
} from './worker/types'

const withPrivateCachePolicy = (request: Request, response: Response) => {
  if (new URL(request.url).pathname.startsWith('/v1/')) {
    response.headers.set('Cache-Control', 'private, no-store')
  }

  return response
}

export default {
  async fetch(
    request: Request,
    env: ApplicationRegistryEnv,
    context: WorkerExecutionContext
  ): Promise<Response> {
    try {
      const response = await applicationRegistryWebHandler(
        request,
        makeWorkerRequestContext(env, context)
      )

      return withPrivateCachePolicy(request, response)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registry API request failed.'

      return withPrivateCachePolicy(
        request,
        Response.json({ code: 'internal_error', message }, { status: 500 })
      )
    }
  },
  scheduled(
    _controller: WorkerScheduledController,
    env: ApplicationRegistryEnv,
    context: WorkerExecutionContext
  ): void {
    if (!listingChecksAreEnabled(env)) return
    context.waitUntil(runScheduledListingChecks(env))
  },
}
