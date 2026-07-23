import { applicationRegistryApiPrefix } from '@cv/application-registry-api-contract'
import { Effect, type Redacted } from 'effect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http'

import type { FactsStorageShape } from '../../facts/storage'
import { makeRegistryBearerTokenVerifier } from '../middleware/auth'

const factsObjectPrefix =
  `${applicationRegistryApiPrefix}/facts/objects` as const

const presentedBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer[\t ]+([^\s]+)$/i)
  return match?.[1] ?? null
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

export const makeFactsObjectRequestHandler = (
  storage: FactsStorageShape,
  registryApiToken: Redacted.Redacted<string>
) => {
  const verify = makeRegistryBearerTokenVerifier(registryApiToken)

  return async (request: Request): Promise<Response> => {
    const presented = presentedBearerToken(request)
    const authorizationFailure = await Effect.runPromise(
      verify(presented ?? '').pipe(
        Effect.match({
          onFailure: (error) => error,
          onSuccess: () => null,
        })
      )
    )
    if (authorizationFailure) {
      const unavailable =
        authorizationFailure._tag === 'ServiceUnavailableError'
      return Response.json(
        {
          code: unavailable ? 'service_unavailable' : 'unauthorized',
          message: authorizationFailure.message,
        },
        { status: unavailable ? 503 : 401 }
      )
    }
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
}

export const makeFactsObjectRoutesLayer = (
  storage: FactsStorageShape,
  registryApiToken: Redacted.Redacted<string>
) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      const handler = makeFactsObjectRequestHandler(storage, registryApiToken)
      yield* router.add(
        '*',
        `${factsObjectPrefix}/*`,
        (request: HttpServerRequest.HttpServerRequest) =>
          HttpServerRequest.toWeb(request).pipe(
            Effect.orDie,
            Effect.flatMap((webRequest) =>
              Effect.promise(() =>
                handler(webRequest).then(HttpServerResponse.fromWeb)
              )
            )
          )
      )
    })
  )
