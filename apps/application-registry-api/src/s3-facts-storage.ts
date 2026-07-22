import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { Effect, Layer } from 'effect'

import {
  FactsStorage,
  FactsStorageError,
  type FactsStorageMetadata,
  type FactsStorageObject,
  type FactsStoragePutInput,
} from './facts/storage'

const httpStatus = (cause: unknown): number | undefined => {
  if (typeof cause !== 'object' || cause === null) return undefined
  const metadata = Reflect.get(cause, '$metadata')
  if (typeof metadata !== 'object' || metadata === null) return undefined
  const status = Reflect.get(metadata, 'httpStatusCode')
  return typeof status === 'number' ? status : undefined
}

const storageError = (
  operation: FactsStorageError['operation'],
  key: string,
  cause: unknown
) =>
  new FactsStorageError({
    cause,
    key,
    message: `MinIO could not ${operation} facts object ${key}.`,
    operation,
  })

const metadata = (
  key: string,
  output: {
    readonly CacheControl?: string
    readonly ContentLength?: number
    readonly ContentType?: string
    readonly ETag?: string
    readonly Metadata?: Record<string, string | undefined>
  }
): Effect.Effect<FactsStorageMetadata, FactsStorageError> => {
  if (output.ETag === undefined || output.ContentLength === undefined) {
    return Effect.fail(
      storageError(
        'head',
        key,
        new Error('MinIO returned incomplete object metadata.')
      )
    )
  }
  return Effect.succeed({
    cacheControl: output.CacheControl,
    etag: output.ETag,
    mediaType: output.ContentType,
    responseEtag: output.ETag,
    sha256: output.Metadata?.sha256,
    size: output.ContentLength,
  })
}

const head = Effect.fn('FactsStorage.S3.head')(function* (
  client: S3Client,
  bucket: string,
  key: string
) {
  const output = yield* Effect.tryPromise({
    try: () => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    catch: (cause) => storageError('head', key, cause),
  }).pipe(
    Effect.catchIf(
      (error) => httpStatus(error.cause) === 404,
      () => Effect.succeed(null)
    )
  )
  return output === null ? null : yield* metadata(key, output)
})

const get = Effect.fn('FactsStorage.S3.get')(function* (
  client: S3Client,
  bucket: string,
  key: string
) {
  const output = yield* Effect.tryPromise({
    try: () => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    catch: (cause) => storageError('get', key, cause),
  }).pipe(
    Effect.catchIf(
      (error) => httpStatus(error.cause) === 404,
      () => Effect.succeed(null)
    )
  )
  if (output === null) return null
  if (output.Body === undefined) {
    return yield* storageError(
      'get',
      key,
      new Error('MinIO returned an object without a body.')
    )
  }
  const objectMetadata = yield* metadata(key, output)
  const body = output.Body
  const bytes = yield* Effect.tryPromise({
    try: async () => new Uint8Array(await body.transformToByteArray()),
    catch: (cause) => storageError('get', key, cause),
  })
  return { ...objectMetadata, bytes } satisfies FactsStorageObject
})

const put = Effect.fn('FactsStorage.S3.put')(function* (
  client: S3Client,
  bucket: string,
  input: FactsStoragePutInput
) {
  return yield* Effect.tryPromise({
    try: () =>
      client.send(
        new PutObjectCommand({
          Body: input.bytes,
          Bucket: bucket,
          CacheControl: input.cacheControl,
          ContentLength: input.bytes.byteLength,
          ContentType: input.mediaType,
          IfMatch:
            input.condition._tag === 'Match' ? input.condition.etag : undefined,
          IfNoneMatch: input.condition._tag === 'Create' ? '*' : undefined,
          Key: input.key,
          Metadata: { sha256: input.sha256 },
        })
      ),
    catch: (cause) => storageError('put', input.key, cause),
  }).pipe(
    Effect.as(true),
    Effect.catchIf(
      (error) => httpStatus(error.cause) === 412,
      () => Effect.succeed(false)
    )
  )
})

export const makeS3FactsStorage = (client: S3Client, bucket: string) =>
  FactsStorage.of({
    get: (key) => get(client, bucket, key),
    head: (key) => head(client, bucket, key),
    put: (input) => put(client, bucket, input),
  })

export const makeS3FactsStorageLayer = (client: S3Client, bucket: string) =>
  Layer.succeed(FactsStorage, makeS3FactsStorage(client, bucket))
