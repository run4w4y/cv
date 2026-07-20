import {
  applicationRegistryApiPrefix,
  applicationRegistryMachinePrefix,
} from '@cv/application-registry-api-contract'
import { Effect, Redacted } from 'effect'
import { handleChatGPTRequest, isChatGPTRequest } from './chatgpt/handler'
import { applicationRegistryWebHandler } from './http/runtime'
import { runScheduledListingChecks } from './scheduled/listing-checks'
import { makeWorkerRequestContext } from './worker/bindings'
import {
  provideWorkerConfiguration,
  readRegistryApiToken,
} from './worker/config'
import { runScheduledPdfDispatches } from './worker/pdf-queue'
import type {
  ApplicationRegistryEnv,
  WorkerExecutionContext,
  WorkerScheduledController,
} from './worker/types'

export { CvPublicResolver } from './internal/cv-public-resolver-entrypoint'

const isRegistryApiPath = (path: string) =>
  path === applicationRegistryApiPrefix ||
  path.startsWith(`${applicationRegistryApiPrefix}/`)

const withPrivateCachePolicy = (request: Request, response: Response) => {
  const path = new URL(request.url).pathname
  if (
    path.startsWith('/api/chatgpt/') ||
    isRegistryApiPath(path) ||
    path === applicationRegistryMachinePrefix ||
    path.startsWith(`${applicationRegistryMachinePrefix}/`)
  ) {
    response.headers.set('Cache-Control', 'private, no-store')
  }

  return response
}

const isMachineTransportRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    path === applicationRegistryMachinePrefix ||
    path.startsWith(`${applicationRegistryMachinePrefix}/`)
  )
}

const presentedBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer[\t ]+([^\s]+)$/i)
  return match?.[1] ?? null
}

const machineTransportError = (status: 401 | 503, message: string): Response =>
  Response.json(
    {
      code: status === 401 ? 'unauthorized' : 'service_unavailable',
      message,
    },
    { status }
  )

const rewriteMachineTransportRequest = (request: Request): Request => {
  const url = new URL(request.url)
  url.pathname =
    url.pathname.slice(applicationRegistryMachinePrefix.length) || '/'
  return new Request(url, request)
}

const machineTransportRequestEffect = Effect.fn(
  'RegistryMachineTransport.prepareRequest'
)(function* (request: Request) {
  const presented = presentedBearerToken(request)
  if (presented === null) {
    return machineTransportError(401, 'Missing or invalid registry API token.')
  }

  const configured = yield* readRegistryApiToken
  if (presented !== Redacted.value(configured)) {
    return machineTransportError(401, 'Missing or invalid registry API token.')
  }

  return rewriteMachineTransportRequest(request)
})

const machineTransportRequest = (
  request: Request,
  env: ApplicationRegistryEnv
): Promise<Request | Response> =>
  machineTransportRequestEffect(request).pipe(
    provideWorkerConfiguration(env),
    Effect.catchTag('Worker.ConfigurationError', () =>
      Effect.succeed(
        machineTransportError(503, 'Registry API token is not configured.')
      )
    ),
    Effect.runPromise
  )

const isRegistryBffRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    request.headers.get('authorization') === null && isRegistryApiPath(path)
  )
}

const isDirectRegistryRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    path === '/health' || path === '/openapi.json' || isRegistryApiPath(path)
  )
}

const registryBffConfigurationError = () =>
  Response.json(
    {
      code: 'service_unavailable',
      message: 'Registry BFF authentication is not configured.',
    },
    { status: 503 }
  )

const registryBffRequestEffect = Effect.fn('RegistryBff.prepareRequest')(
  function* (request: Request) {
    const token = yield* readRegistryApiToken
    const proxied = new Request(request)
    proxied.headers.set('authorization', `Bearer ${Redacted.value(token)}`)
    return proxied
  }
)

const registryBffRequest = (
  request: Request,
  env: ApplicationRegistryEnv
): Promise<Request | Response> =>
  registryBffRequestEffect(request).pipe(
    provideWorkerConfiguration(env),
    Effect.catchTag('Worker.ConfigurationError', () =>
      Effect.succeed(registryBffConfigurationError())
    ),
    Effect.runPromise
  )

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

      if (isMachineTransportRequest(request)) {
        const proxied = await machineTransportRequest(request, env)
        if (proxied instanceof Response) {
          return withPrivateCachePolicy(request, proxied)
        }

        return withPrivateCachePolicy(
          request,
          await applicationRegistryWebHandler(env)(
            proxied,
            makeWorkerRequestContext(env, context)
          )
        )
      }

      if (isRegistryBffRequest(request)) {
        const proxied = await registryBffRequest(request, env)
        if (proxied instanceof Response) {
          return withPrivateCachePolicy(request, proxied)
        }

        return withPrivateCachePolicy(
          request,
          await applicationRegistryWebHandler(env)(
            proxied,
            makeWorkerRequestContext(env, context)
          )
        )
      }

      if (!isDirectRegistryRequest(request) && env.ASSETS) {
        return env.ASSETS.fetch(request)
      }

      const response = await applicationRegistryWebHandler(env)(
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
    controller: WorkerScheduledController,
    env: ApplicationRegistryEnv,
    context: WorkerExecutionContext
  ): void {
    context.waitUntil(
      controller.cron === '*/5 * * * *'
        ? runScheduledPdfDispatches(env)
        : runScheduledListingChecks(env)
    )
  },
}
