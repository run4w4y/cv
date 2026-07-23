import { timingSafeEqual } from 'node:crypto'

import {
  applicationRegistryApiPrefix,
  applicationRegistryMachinePrefix,
  factsPublicationApiPrefix,
} from '@cv/application-registry-api-contract'
import { Effect, Redacted } from 'effect'
import type { ApiServerConfiguration } from './config'
import type { FactsStorageShape } from './facts/storage'

const factsObjectPrefix = `${applicationRegistryApiPrefix}/facts/objects`

const isPathAt = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`)

const isRegistryApiPath = (path: string) =>
  isPathAt(path, applicationRegistryApiPrefix)

const isFactsPublicationRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    isPathAt(path, factsPublicationApiPrefix) &&
    !isPathAt(path, `${factsPublicationApiPrefix}/objects`)
  )
}

const isMachineTransportRequest = (request: Request) =>
  isPathAt(new URL(request.url).pathname, applicationRegistryMachinePrefix)

const isRegistryBffRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return (
    request.headers.get('authorization') === null && isRegistryApiPath(path)
  )
}

const presentedBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer[\t ]+([^\s]+)$/i)
  return match?.[1] ?? null
}

const sameToken = (left: string, right: string) => {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  )
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

const withRegistryBearer = (request: Request, token: string): Request => {
  const proxied = new Request(request)
  proxied.headers.set('authorization', `Bearer ${token}`)
  return proxied
}

const factsObjectKey = (request: Request): string | null => {
  const path = new URL(request.url).pathname
  if (!path.startsWith(`${factsObjectPrefix}/`)) return null
  const encoded = path.slice(factsObjectPrefix.length + 1)
  if (encoded.length === 0 || encoded.length > 1_024) return null

  try {
    const segments = encoded.split('/').map(decodeURIComponent)
    if (
      segments.some(
        (segment) =>
          segment.length === 0 ||
          segment === '.' ||
          segment === '..' ||
          segment.includes('/') ||
          segment.includes('\\') ||
          segment.includes('\0')
      )
    ) {
      return null
    }
    return segments.join('/')
  } catch {
    return null
  }
}

const factsObjectResponse = async (
  request: Request,
  storage: FactsStorageShape
): Promise<Response | null> => {
  const path = new URL(request.url).pathname
  if (!isPathAt(path, factsObjectPrefix)) return null
  if (request.method !== 'GET') {
    return Response.json(
      { code: 'method_not_allowed', message: 'Facts objects are read-only.' },
      { headers: { Allow: 'GET' }, status: 405 }
    )
  }

  const key = factsObjectKey(request)
  if (key === null) {
    return Response.json(
      { code: 'invalid_request', message: 'Invalid facts object key.' },
      { status: 400 }
    )
  }
  const object = await Effect.runPromise(storage.get(key))
  if (object === null) {
    return Response.json(
      { code: 'not_found', message: 'Facts object was not found.' },
      { status: 404 }
    )
  }

  const headers = new Headers({
    ETag: object.responseEtag,
    'X-CV-Facts-SHA256': object.sha256 ?? '',
  })
  if (object.mediaType) headers.set('Content-Type', object.mediaType)
  if (object.cacheControl) headers.set('Cache-Control', object.cacheControl)
  if (!object.sha256) headers.delete('X-CV-Facts-SHA256')
  const body = new ArrayBuffer(object.bytes.byteLength)
  new Uint8Array(body).set(object.bytes)
  return new Response(body, { headers })
}

const withPrivateCachePolicy = (request: Request, response: Response) => {
  const path = new URL(request.url).pathname
  if (
    isRegistryApiPath(path) ||
    isPathAt(path, applicationRegistryMachinePrefix)
  ) {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}

export interface ApiServerRequestHandlerOptions {
  readonly apiHandler: (request: Request) => Promise<Response>
  readonly configuration: ApiServerConfiguration
  readonly factsStorage: FactsStorageShape
}

export const makeApiServerRequestHandler = (
  options: ApiServerRequestHandlerOptions
) => {
  const registryToken = Redacted.value(
    options.configuration.authentication.registryApiToken
  )

  return async (request: Request): Promise<Response> => {
    try {
      if (isFactsPublicationRequest(request)) {
        return withPrivateCachePolicy(
          request,
          await options.apiHandler(request)
        )
      }

      if (isMachineTransportRequest(request)) {
        const presented = presentedBearerToken(request)
        if (presented === null || !sameToken(presented, registryToken)) {
          return withPrivateCachePolicy(
            request,
            machineTransportError(401, 'Missing or invalid registry API token.')
          )
        }
        const proxied = rewriteMachineTransportRequest(request)
        const facts = await factsObjectResponse(proxied, options.factsStorage)
        return withPrivateCachePolicy(
          request,
          facts ?? (await options.apiHandler(proxied))
        )
      }

      if (isRegistryBffRequest(request)) {
        if (!options.configuration.authentication.bffEnabled) {
          return withPrivateCachePolicy(
            request,
            machineTransportError(
              401,
              'Registry BFF authentication is disabled for this origin.'
            )
          )
        }
        const proxied = withRegistryBearer(request, registryToken)
        const facts = await factsObjectResponse(proxied, options.factsStorage)
        return withPrivateCachePolicy(
          request,
          facts ?? (await options.apiHandler(proxied))
        )
      }

      return withPrivateCachePolicy(request, await options.apiHandler(request))
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Registry API request failed.'
      return withPrivateCachePolicy(
        request,
        Response.json({ code: 'internal_error', message }, { status: 500 })
      )
    }
  }
}
