import { S3Client } from '@aws-sdk/client-s3'
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect, Redacted } from 'effect'

import { readApiServerConfiguration } from './config'
import { makeApiServerRequestHandler } from './request-handler'
import { makeApiWebHandler } from './runtime'
import { makeS3FactsStorage } from './s3-facts-storage'

const program = Effect.scoped(
  Effect.gen(function* () {
    const configuration = yield* readApiServerConfiguration
    const s3 = yield* Effect.acquireRelease(
      Effect.sync(
        () =>
          new S3Client({
            credentials: {
              accessKeyId: Redacted.value(configuration.minio.accessKeyId),
              secretAccessKey: Redacted.value(
                configuration.minio.secretAccessKey
              ),
            },
            endpoint: configuration.minio.endpoint.href,
            forcePathStyle: configuration.minio.forcePathStyle,
            region: configuration.minio.region,
          })
      ),
      (client) => Effect.sync(() => client.destroy())
    )
    const api = yield* Effect.acquireRelease(
      Effect.sync(() => makeApiWebHandler(configuration, s3)),
      (handler) => Effect.promise(handler.dispose)
    )
    const factsStorage = makeS3FactsStorage(s3, configuration.minio.factsBucket)
    const fetch = makeApiServerRequestHandler({
      apiHandler: api.handler,
      configuration,
      factsStorage,
    })
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          fetch,
          hostname: configuration.http.host,
          port: configuration.http.port,
        })
      ),
      (server) => Effect.promise(() => server.stop(true))
    )

    yield* Console.log(
      JSON.stringify({
        address: server.url.href,
        bffEnabled: configuration.authentication.bffEnabled,
        service: 'application-registry-api',
      })
    )
    yield* Effect.never
  })
)

BunRuntime.runMain(program)
