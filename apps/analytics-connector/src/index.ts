import { errorResponse, isKnownConnectorPath } from './http/compat'
import { analyticsConnectorWebHandler } from './http/runtime'
import { makeWorkerRequestContext } from './worker/bindings'
import type {
  AnalyticsConnectorEnv,
  WorkerExecutionContext,
} from './worker/types'

const withExternalCachePolicy = (request: Request, response: Response) => {
  if (
    request.method === 'GET' &&
    new URL(request.url).pathname.startsWith('/v1/')
  ) {
    response.headers.set('Cache-Control', 'private, no-store')
  }

  return response
}

export default {
  async fetch(
    request: Request,
    env: AnalyticsConnectorEnv,
    context: WorkerExecutionContext
  ): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'OPTIONS') {
      return errorResponse(405, 'method_not_allowed', 'Only GET is supported.')
    }

    if (request.method === 'GET' && !isKnownConnectorPath(request)) {
      return errorResponse(
        404,
        'not_found',
        'Unknown analytics connector route.'
      )
    }

    try {
      const response = await analyticsConnectorWebHandler(
        request,
        makeWorkerRequestContext(env, context)
      )

      return withExternalCachePolicy(request, response)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Analytics connector request failed.'

      return withExternalCachePolicy(
        request,
        errorResponse(500, 'internal_error', message)
      )
    }
  },
}
