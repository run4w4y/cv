import { cache } from 'cloudflare:workers'

import openNextWorker from './.open-next/worker.js'
import {
  handlePublicCachePurge,
  internalRevalidationPath,
  isApplicationRoute,
  notFoundResponse,
  publicToken,
  withoutSharedCaching,
  withPublicCaching,
} from './src/server/public-cache'

type OpenNextWorker = {
  readonly fetch: (
    request: Request,
    env: CloudflareEnv,
    context: WorkerExecutionContext
  ) => Promise<Response>
}

type WorkerExecutionContext = {
  readonly passThroughOnException: () => void
  readonly waitUntil: (promise: Promise<unknown>) => void
}

const application: OpenNextWorker = openNextWorker

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    context: WorkerExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname
    if (pathname === internalRevalidationPath) {
      return handlePublicCachePurge(
        request,
        env.CV_REVALIDATION_SECRET,
        (options) => cache.purge(options)
      )
    }
    if (!isApplicationRoute(pathname)) return notFoundResponse()

    const token = publicToken(pathname)
    if (token !== null && url.search.length > 0) return notFoundResponse()

    const response = await application.fetch(request, env, context)
    if (token !== null) {
      return request.method === 'GET' || request.method === 'HEAD'
        ? withPublicCaching(response, token)
        : withoutSharedCaching(response)
    }
    return pathname.startsWith('/c/_preview/')
      ? withoutSharedCaching(response)
      : response
  },
}
