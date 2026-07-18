import { handleChatGPTRequest, isChatGPTRequest } from './chatgpt/handler'
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

export { CvPublicResolver } from './internal/cv-public-resolver-entrypoint'
export { CvPdfWorkflow } from './pdf/entrypoint'

const withPrivateCachePolicy = (request: Request, response: Response) => {
  const path = new URL(request.url).pathname
  if (
    path.startsWith('/v1/') ||
    path.startsWith('/api/chatgpt/') ||
    path.startsWith('/api/registry/')
  ) {
    response.headers.set('Cache-Control', 'private, no-store')
  }

  return response
}

const isRegistryBffRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return path === '/api/registry' || path.startsWith('/api/registry/')
}

const isDirectRegistryRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    path === '/health' ||
    path === '/openapi.json' ||
    path === '/v1' ||
    path.startsWith('/v1/')
  )
}

const registryBffRequest = (
  request: Request,
  env: ApplicationRegistryEnv
): Request | Response => {
  const token = env.REGISTRY_API_TOKEN?.trim()
  if (!token) {
    return Response.json(
      {
        code: 'service_unavailable',
        message: 'Registry BFF authentication is not configured.',
      },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  url.pathname = url.pathname.slice('/api/registry'.length) || '/'
  const proxied = new Request(url, request)
  proxied.headers.set('authorization', `Bearer ${token}`)
  return proxied
}

export default {
  async fetch(
    request: Request,
    env: ApplicationRegistryEnv,
    context: WorkerExecutionContext
  ): Promise<Response> {
    try {
      if (isChatGPTRequest(request)) {
        return withPrivateCachePolicy(
          request,
          await handleChatGPTRequest(request, env)
        )
      }

      if (isRegistryBffRequest(request)) {
        const proxied = registryBffRequest(request, env)
        if (proxied instanceof Response) {
          return withPrivateCachePolicy(request, proxied)
        }

        return withPrivateCachePolicy(
          request,
          await applicationRegistryWebHandler(
            proxied,
            makeWorkerRequestContext(env, context)
          )
        )
      }

      if (!isDirectRegistryRequest(request) && env.ASSETS) {
        return env.ASSETS.fetch(request)
      }

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
