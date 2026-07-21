import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { Effect, Layer, Option } from 'effect'

import {
  ArtifactStoreIntegrityError,
  ArtifactStoreNotFoundError,
  ArtifactStoreReadError,
  ArtifactStoreWriteError,
} from '../errors'
import { artifactKey, validateSha256 } from '../internal/address'
import { sha256 } from '../internal/hash'
import {
  type ArtifactObjectMetadata,
  verifyArtifactBytes,
  verifyObjectMetadata,
} from '../internal/metadata'
import {
  type ArtifactMetadata,
  ArtifactStore,
  type ArtifactStoreShape,
} from '../service'

const httpStatus = (cause: unknown): number | undefined => {
  if (typeof cause !== 'object' || cause === null) return undefined
  const metadata = Reflect.get(cause, '$metadata')
  if (typeof metadata !== 'object' || metadata === null) return undefined
  const status = Reflect.get(metadata, 'httpStatusCode')
  return typeof status === 'number' ? status : undefined
}

const isMissing = (cause: unknown) => httpStatus(cause) === 404
const isPreconditionFailed = (cause: unknown) => httpStatus(cause) === 412

const metadataRecord = (
  input: Record<string, string | undefined> | undefined
): Record<string, string> | undefined => {
  if (input === undefined) return undefined
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
}

const objectMetadata = (
  key: string,
  output: {
    readonly ContentLength?: number
    readonly Metadata?: Record<string, string | undefined>
  }
): ArtifactObjectMetadata => ({
  checksums: {},
  customMetadata: (() => {
    const values = metadataRecord(output.Metadata)
    if (values === undefined) return undefined
    return {
      ...values,
      byteLength: values.byteLength ?? values.bytelength,
      sha256: values.sha256,
    }
  })(),
  key,
  size: output.ContentLength ?? -1,
})

const headObject = Effect.fn('ArtifactStore.S3.headObject')(function* (
  client: S3Client,
  bucket: string,
  key: string,
  operation: 'head' | 'read'
) {
  return yield* Effect.tryPromise({
    try: () => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not ${operation} artifact "${key}".`,
        operation,
      }),
  }).pipe(
    Effect.map((output) => objectMetadata(key, output)),
    Effect.catchIf(
      (error) => isMissing(error.cause),
      () => Effect.succeed<ArtifactObjectMetadata | null>(null)
    )
  )
})

const readBytes = Effect.fn('ArtifactStore.S3.readBytes')(function* (
  client: S3Client,
  bucket: string,
  key: string
) {
  const output = yield* Effect.tryPromise({
    try: () => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not read artifact "${key}".`,
        operation: 'read',
      }),
  })
  if (output.Body === undefined) {
    return yield* new ArtifactStoreReadError({
      cause: new Error('S3 returned an object without a body.'),
      key,
      message: `Could not read artifact body "${key}".`,
      operation: 'read',
    })
  }
  const body = output.Body
  return yield* Effect.tryPromise({
    try: async () => new Uint8Array(await body.transformToByteArray()),
    catch: (cause) =>
      new ArtifactStoreReadError({
        cause,
        key,
        message: `Could not read artifact body "${key}".`,
        operation: 'read',
      }),
  })
})

export const makeS3ArtifactStore = (
  client: S3Client,
  bucket: string
): ArtifactStoreShape => ({
  head: (requestedSha256) =>
    Effect.gen(function* () {
      const digest = yield* validateSha256(requestedSha256)
      const key = artifactKey(digest)
      const object = yield* headObject(client, bucket, key, 'head')
      return object === null
        ? Option.none<ArtifactMetadata>()
        : Option.some(yield* verifyObjectMetadata(object, digest))
    }),
  put: (input) =>
    Effect.gen(function* () {
      const bytes = input.slice()
      const digest = yield* sha256(bytes)
      const key = artifactKey(digest.hex)
      const stored = yield* Effect.tryPromise({
        try: () =>
          client.send(
            new PutObjectCommand({
              Body: bytes,
              Bucket: bucket,
              ContentLength: bytes.byteLength,
              IfNoneMatch: '*',
              Key: key,
              Metadata: {
                byteLength: String(bytes.byteLength),
                sha256: digest.hex,
              },
            })
          ),
        catch: (cause) =>
          new ArtifactStoreWriteError({
            cause,
            key,
            message: `Could not store artifact "${key}".`,
          }),
      }).pipe(
        Effect.as(true),
        Effect.catchIf(
          (error) => isPreconditionFailed(error.cause),
          () => Effect.succeed(false)
        )
      )

      const object = yield* headObject(client, bucket, key, 'head')
      if (object === null) {
        return yield* new ArtifactStoreWriteError({
          cause: new Error(
            stored
              ? 'S3 did not expose the object after writing it.'
              : 'The conditional write failed without an existing object.'
          ),
          key,
          message: `Could not confirm artifact "${key}" after writing it.`,
        })
      }

      const metadata = yield* verifyObjectMetadata(object, digest.hex)
      if (metadata.byteLength !== bytes.byteLength) {
        return yield* new ArtifactStoreIntegrityError({
          key,
          message: `Artifact "${key}" already exists with another byte length.`,
          sha256: digest.hex,
        })
      }
      return metadata
    }),
  read: (requestedSha256) =>
    Effect.gen(function* () {
      const digest = yield* validateSha256(requestedSha256)
      const key = artifactKey(digest)
      const object = yield* headObject(client, bucket, key, 'read')
      if (object === null) {
        return yield* new ArtifactStoreNotFoundError({
          key,
          message: `Artifact "${key}" does not exist.`,
          sha256: digest,
        })
      }

      const metadata = yield* verifyObjectMetadata(object, digest)
      const bytes = yield* readBytes(client, bucket, key)
      const actualDigest = yield* sha256(bytes)
      yield* verifyArtifactBytes(bytes, metadata, actualDigest.hex)
      return bytes.slice()
    }),
})

export const makeS3ArtifactStoreLayer = (client: S3Client, bucket: string) =>
  Layer.succeed(ArtifactStore, makeS3ArtifactStore(client, bucket))
