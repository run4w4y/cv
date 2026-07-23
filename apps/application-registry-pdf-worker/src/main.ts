import { S3Client } from '@aws-sdk/client-s3'
import {
  makeNatsRegistryEventSourceLayer,
  makeRegistryEventConsumerConfiguration,
  makeRegistryEventTopology,
} from '@cv/application-registry-events-nats'
import { NodeRuntime } from '@effect/platform-node'
import { Console, Effect, Layer, Redacted } from 'effect'

import { readPdfWorkerConfiguration } from './config'
import { runPdfEventConsumer } from './consumer'
import { makePdfArtifactPersistenceLayer } from './persistence'
import { makePlaywrightPdfRendererLayer } from './renderer'

const program = Effect.scoped(
  Effect.gen(function* () {
    const configuration = yield* readPdfWorkerConfiguration
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
    const topology = makeRegistryEventTopology()
    const source = makeNatsRegistryEventSourceLayer(
      makeRegistryEventConsumerConfiguration({
        consumerName: 'registry-pdf-worker',
        nats: {
          clientName: 'application-registry-pdf-worker-consumer',
          maxReconnectAttempts: -1,
          password: Redacted.value(configuration.nats.password),
          server: configuration.nats.server,
          username: configuration.nats.username,
        },
        topology,
      })
    )
    const runtime = Layer.mergeAll(
      source,
      makePdfArtifactPersistenceLayer(configuration, s3),
      makePlaywrightPdfRendererLayer(configuration.browser.cdpUrl)
    )

    yield* Console.log(
      JSON.stringify({
        consumer: 'registry-pdf-worker',
        service: 'application-registry-pdf-worker',
        stream: topology.streamName,
      })
    )
    yield* runPdfEventConsumer(configuration.heartbeatMilliseconds).pipe(
      Effect.provide(runtime)
    )
  })
)

NodeRuntime.runMain(program)
