import { Credentials, Endpoint, Region } from '@distilled.cloud/aws'
import * as S3 from '@distilled.cloud/aws/s3'
import { Effect, Layer, Redacted, Stream } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import type * as HttpClient from 'effect/unstable/http/HttpClient'

import { FactsObjectNotFoundError, FactsObjectStoreError } from './errors'
import {
  FactsObjectStore,
  type StoredFactsObject,
  type WritableFactsObject,
} from './object-store'

export type FactsR2Options = {
  readonly accessKeyId: Redacted.Redacted<string>
  readonly bucket: string
  readonly endpoint: string
  readonly secretAccessKey: Redacted.Redacted<string>
}

export const cloudflareR2Endpoint = (accountId: string): string =>
  `https://${accountId}.r2.cloudflarestorage.com`

const storeError = (
  operation: FactsObjectStoreError['operation'],
  key: string,
  cause: unknown
) =>
  new FactsObjectStoreError({
    cause,
    key,
    message: `Could not ${operation} private facts object ${key}.`,
    operation,
  })

const concatenate = (values: ReadonlyArray<Uint8Array>): Uint8Array => {
  const byteLength = values.reduce(
    (total, value) => total + value.byteLength,
    0
  )
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const value of values) {
    bytes.set(value, offset)
    offset += value.byteLength
  }
  return bytes
}

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false
  return left.every((value, index) => value === right[index])
}

const readBody = (key: string, body: S3.GetObjectOutput['Body']) =>
  body === undefined
    ? Effect.fail(storeError('get', key, new Error('Missing object body.')))
    : body.pipe(
        Stream.runCollect,
        Effect.map(concatenate),
        Effect.mapError((cause) => storeError('get', key, cause))
      )

const getObject = Effect.fn('FactsObjectStore.get')(function* (
  bucket: string,
  key: string
) {
  const response = yield* S3.getObject({ Bucket: bucket, Key: key }).pipe(
    Effect.catchTag('NoSuchKey', () =>
      Effect.fail(
        new FactsObjectNotFoundError({
          key,
          message: `Private facts object ${key} does not exist.`,
        })
      )
    ),
    Effect.mapError((cause) =>
      cause instanceof FactsObjectNotFoundError
        ? cause
        : storeError('get', key, cause)
    )
  )
  const bytes = yield* readBody(key, response.Body)
  return {
    bytes,
    cacheControl: response.CacheControl,
    etag: response.ETag,
    mediaType: response.ContentType,
    sha256: response.Metadata?.sha256,
  } satisfies StoredFactsObject
})

const verifyExisting = Effect.fn('FactsObjectStore.verifyExisting')(function* (
  bucket: string,
  object: WritableFactsObject
) {
  const existing = yield* S3.headObject({
    Bucket: bucket,
    Key: object.key,
  }).pipe(Effect.mapError((cause) => storeError('head', object.key, cause)))
  if (
    existing.ContentLength !== object.bytes.byteLength ||
    existing.ContentType !== object.mediaType ||
    existing.Metadata?.sha256 !== object.sha256
  ) {
    return yield* Effect.fail(
      storeError(
        'head',
        object.key,
        new Error('Existing immutable object metadata does not match.')
      )
    )
  }
})

const writeObject = (
  bucket: string,
  object: WritableFactsObject,
  immutable: boolean
) => {
  const request = S3.putObject({
    Body: object.bytes,
    Bucket: bucket,
    CacheControl: object.cacheControl,
    ContentLength: object.bytes.byteLength,
    ContentType: object.mediaType,
    ...(immutable ? { IfNoneMatch: '*' } : {}),
    Key: object.key,
    Metadata: { sha256: object.sha256 },
  })
  const mapWriteError = Effect.mapError((cause: unknown) =>
    cause instanceof FactsObjectStoreError
      ? cause
      : storeError('put', object.key, cause)
  )
  if (!immutable) {
    return request.pipe(Effect.asVoid, mapWriteError)
  }
  return request.pipe(
    Effect.catchTags({
      ConditionalRequestConflict: () => verifyExisting(bucket, object),
      PreconditionFailed: () => verifyExisting(bucket, object),
    }),
    Effect.asVoid,
    mapWriteError
  )
}

export const factsR2ObjectStoreLayer = (
  options: FactsR2Options,
  httpClientLayer: Layer.Layer<HttpClient.HttpClient> = FetchHttpClient.layer
): Layer.Layer<FactsObjectStore> => {
  const awsLayer = Layer.mergeAll(
    Credentials.fromCredentials({
      accessKeyId: Redacted.value(options.accessKeyId),
      secretAccessKey: Redacted.value(options.secretAccessKey),
    }),
    Layer.succeed(Endpoint.Endpoint, Effect.succeed(options.endpoint)),
    Layer.succeed(Region.Region, Effect.succeed('auto')),
    httpClientLayer
  )

  const get = (key: string) =>
    getObject(options.bucket, key).pipe(Effect.provide(awsLayer))
  const putCurrent = Effect.fn('FactsObjectStore.putCurrent')(function* (
    object: WritableFactsObject
  ) {
    const existing = yield* get(object.key).pipe(
      Effect.map((value) => value.bytes),
      Effect.catchTag('FactsObjectNotFoundError', () =>
        Effect.succeed<Uint8Array | undefined>(undefined)
      )
    )
    if (existing !== undefined && sameBytes(existing, object.bytes)) {
      return 'already-active' as const
    }
    yield* writeObject(options.bucket, object, false).pipe(
      Effect.provide(awsLayer)
    )
    return 'activated' as const
  })
  const putImmutable = Effect.fn('FactsObjectStore.putImmutable')(
    (object: WritableFactsObject) =>
      writeObject(options.bucket, object, true).pipe(Effect.provide(awsLayer))
  )
  return Layer.succeed(
    FactsObjectStore,
    FactsObjectStore.of({ get, putCurrent, putImmutable })
  )
}
