import { Effect, Layer } from 'effect'
import { HttpClient } from 'effect/unstable/http'

import { FactsObjectNotFoundError, FactsObjectStoreError } from './errors'
import { FactsObjectStore, type StoredFactsObject } from './object-store'

const defaultBaseUrl = '/api/registry/facts/objects'

const objectUrl = (baseUrl: string, key: string) =>
  `${baseUrl.replace(/\/+$/u, '')}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`

const storeError = (key: string, cause: unknown) =>
  new FactsObjectStoreError({
    cause,
    key,
    message: `Could not get private facts object ${key}.`,
    operation: 'get',
  })

/** Read-only same-origin store used by the management application. */
export const factsHttpObjectStoreLayer = (
  baseUrl = defaultBaseUrl
): Layer.Layer<FactsObjectStore, never, HttpClient.HttpClient> =>
  Layer.effect(
    FactsObjectStore,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const get = Effect.fn('FactsHttpObjectStore.get')(function* (
        key: string
      ) {
        const response = yield* client
          .get(objectUrl(baseUrl, key), {
            headers: { Accept: 'application/json' },
          })
          .pipe(Effect.mapError((cause) => storeError(key, cause)))

        if (response.status === 404) {
          return yield* Effect.fail(
            new FactsObjectNotFoundError({
              key,
              message: `Private facts object ${key} does not exist.`,
            })
          )
        }
        if (response.status < 200 || response.status >= 300) {
          return yield* Effect.fail(
            storeError(
              key,
              new Error(`Facts proxy returned ${response.status}.`)
            )
          )
        }

        const body = yield* response.arrayBuffer.pipe(
          Effect.mapError((cause) => storeError(key, cause))
        )
        return {
          bytes: new Uint8Array(body),
          cacheControl: response.headers['cache-control'],
          etag: response.headers.etag,
          mediaType: response.headers['content-type'],
          sha256: response.headers['x-cv-facts-sha256'],
        } satisfies StoredFactsObject
      })

      return FactsObjectStore.of({ get })
    })
  )
