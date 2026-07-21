import { S3Client } from '@aws-sdk/client-s3'
import {
  makePdfQueueConfiguration,
  makePdfQueueLayer,
} from '@cv/application-registry-pdf-queue'
import { NodeRuntime } from '@effect/platform-node'
import { Console, Effect, Layer, Redacted } from 'effect'
import { chromium } from 'playwright'

import { readPdfRunnerConfiguration } from './config'
import { runPdfQueue } from './consumer'
import { makePdfArtifactPersistenceLayer } from './persistence'
import { makePlaywrightPdfRendererLayer } from './renderer'

const program = Effect.scoped(
  Effect.gen(function* () {
    const configuration = yield* readPdfRunnerConfiguration
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
    const browser = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => chromium.launch({ headless: true }),
        catch: (cause) => new Error('Could not start Chromium.', { cause }),
      }),
      (browser) => Effect.promise(() => browser.close())
    )
    const queue = makePdfQueueLayer(
      makePdfQueueConfiguration({
        nats: {
          clientName: 'cv-pdf-runner',
          maxReconnectAttempts: -1,
          password: Redacted.value(configuration.nats.password),
          server: configuration.nats.server,
          username: configuration.nats.username,
        },
      })
    )
    const runtime = Layer.mergeAll(
      queue,
      makePdfArtifactPersistenceLayer(configuration, s3),
      makePlaywrightPdfRendererLayer(browser)
    )

    yield* Console.log(
      JSON.stringify({
        consumer: 'cv-pdf',
        service: 'cv-pdf-runner',
        stream: 'CV_PDF',
      })
    )
    yield* runPdfQueue(configuration.heartbeatMilliseconds).pipe(
      Effect.provide(runtime)
    )
  })
)

NodeRuntime.runMain(program)
