import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { makeS3ArtifactStore } from '@cv/application-registry-artifact-store/live'
import {
  type StartedMinioTestContainer,
  startMinioTestContainer,
} from '@cv/test-infrastructure/minio'
import { Effect, Option } from 'effect'

import { makeS3FactsStorage } from '../src/s3-facts-storage'

let minio: StartedMinioTestContainer

before(
  async () => {
    minio = await startMinioTestContainer()
  },
  { timeout: 60_000 }
)

after(
  async () => {
    await minio?.dispose()
  },
  { timeout: 30_000 }
)

const emptyAndDeleteBucket = async (client: S3Client, bucket: string) => {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket }))
  const objects = listed.Contents?.flatMap(({ Key }) =>
    Key === undefined ? [] : [{ Key }]
  )
  if (objects !== undefined && objects.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      })
    )
  }
  await client.send(new DeleteBucketCommand({ Bucket: bucket }))
}

describe('MinIO storage adapters', () => {
  test('supports facts compare-and-set and immutable artifact writes', {
    timeout: 30_000,
  }, async () => {
    const suffix = crypto.randomUUID().replaceAll('-', '')
    const factsBucket = `cv-facts-${suffix}`
    const objectsBucket = `cv-objects-${suffix}`
    const client = new S3Client({
      credentials: {
        accessKeyId: minio.accessKeyId,
        secretAccessKey: minio.secretAccessKey,
      },
      endpoint: minio.endpoint.href,
      forcePathStyle: minio.forcePathStyle,
      region: minio.region,
    })

    try {
      await client.send(new CreateBucketCommand({ Bucket: factsBucket }))
      await client.send(new CreateBucketCommand({ Bucket: objectsBucket }))

      const facts = makeS3FactsStorage(client, factsBucket)
      const original = new TextEncoder().encode('{"release":"first"}')
      const replacement = new TextEncoder().encode('{"release":"second"}')
      const key = 'releases/current.json'
      const base = {
        cacheControl: 'private, no-cache',
        key,
        mediaType: 'application/json',
        sha256: 'a'.repeat(64),
      }

      assert.equal(
        await Effect.runPromise(
          facts.put({
            ...base,
            bytes: original,
            condition: { _tag: 'Create' },
          })
        ),
        true
      )
      assert.equal(
        await Effect.runPromise(
          facts.put({
            ...base,
            bytes: original,
            condition: { _tag: 'Create' },
          })
        ),
        false
      )

      const before = await Effect.runPromise(facts.get(key))
      assert.deepEqual(before?.bytes, original)
      if (before === null)
        throw new Error('Expected the facts object to exist.')

      assert.equal(
        await Effect.runPromise(
          facts.put({
            ...base,
            bytes: replacement,
            condition: { _tag: 'Match', etag: before.etag },
            sha256: 'b'.repeat(64),
          })
        ),
        true
      )
      assert.equal(
        await Effect.runPromise(
          facts.put({
            ...base,
            bytes: original,
            condition: { _tag: 'Match', etag: before.etag },
          })
        ),
        false
      )

      const artifacts = makeS3ArtifactStore(client, objectsBucket)
      const artifactBytes = new TextEncoder().encode('immutable artifact')
      const stored = await Effect.runPromise(artifacts.put(artifactBytes))
      const storedAgain = await Effect.runPromise(artifacts.put(artifactBytes))
      assert.deepEqual(storedAgain, stored)
      assert.deepEqual(
        await Effect.runPromise(artifacts.read(stored.sha256)),
        artifactBytes
      )
      assert.equal(
        Option.isSome(await Effect.runPromise(artifacts.head(stored.sha256))),
        true
      )
    } finally {
      await Promise.allSettled([
        emptyAndDeleteBucket(client, factsBucket),
        emptyAndDeleteBucket(client, objectsBucket),
      ])
      client.destroy()
    }
  })
})
