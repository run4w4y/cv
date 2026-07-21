import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  makePdfQueueConfiguration,
  makePdfQueueLayer,
} from '@cv/application-registry-pdf-queue'
import { PdfDispatchesServiceLive } from '@cv/application-registry-service/live'
import { BunRuntime } from '@effect/platform-bun'
import { PgClient } from '@effect/sql-pg'
import { Console, Effect, Layer, Redacted, Schema } from 'effect'

import {
  type PdfDispatcherConfiguration,
  readPdfDispatcherConfiguration,
} from './config'
import { dispatchPendingPdfJobs } from './dispatcher'

class PdfDispatchBatchError extends Schema.TaggedErrorClass<PdfDispatchBatchError>()(
  'PdfDispatchBatchError',
  {
    failed: Schema.Int,
    message: Schema.String,
  }
) {}

const makeRuntimeLayer = (configuration: PdfDispatcherConfiguration) => {
  const postgres = PgClient.layer({
    applicationName: 'application-registry-pdf-dispatcher',
    connectTimeout: '10 seconds',
    database: configuration.postgres.database,
    host: configuration.postgres.host,
    maxConnections: configuration.postgres.maxConnections,
    password: configuration.postgres.password,
    port: configuration.postgres.port,
    username: configuration.postgres.username,
  })
  const crud = RegistryCrudLive.pipe(Layer.provide(postgres))
  const dispatches = PdfDispatchesServiceLive.pipe(Layer.provide(crud))
  const queue = makePdfQueueLayer(
    makePdfQueueConfiguration({
      nats: {
        clientName: 'application-registry-pdf-dispatcher',
        maxReconnectAttempts: 3,
        password: Redacted.value(configuration.nats.password),
        server: configuration.nats.server,
        username: configuration.nats.username,
      },
    })
  )

  return Layer.merge(dispatches, queue)
}

const program = Effect.gen(function* () {
  const configuration = yield* readPdfDispatcherConfiguration
  const summary = yield* dispatchPendingPdfJobs(configuration.batchSize).pipe(
    Effect.provide(makeRuntimeLayer(configuration)),
    Effect.timeout('3 minutes')
  )

  yield* Console.log(JSON.stringify({ service: 'pdf-dispatcher', ...summary }))
  if (summary.failed > 0) {
    return yield* new PdfDispatchBatchError({
      failed: summary.failed,
      message: `${summary.failed} PDF job(s) could not be published.`,
    })
  }
})

BunRuntime.runMain(program)
