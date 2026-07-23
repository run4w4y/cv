import { RegistryCrudLive } from '@cv/application-registry-crud/live'
import {
  makeNatsRegistryEventPublisherLayer,
  makeRegistryEventPublisherConfiguration,
} from '@cv/application-registry-events-nats'
import { ListingAvailabilityCheckerLive } from '@cv/application-registry-listing-check'
import { ScheduledListingChecksRunner } from '@cv/application-registry-service'
import { ScheduledListingChecksRunnerLive } from '@cv/application-registry-service/live'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { PgClient } from '@effect/sql-pg'
import { Console, Effect, Layer, Redacted } from 'effect'

import { type RunnerConfiguration, readRunnerConfiguration } from './config'

const makeRuntimeLayer = (configuration: RunnerConfiguration) => {
  const postgres = PgClient.layer({
    applicationName: 'application-registry-listing-check-runner',
    connectTimeout: '10 seconds',
    database: configuration.postgres.database,
    host: configuration.postgres.host,
    maxConnections: configuration.maxConnections,
    password: configuration.postgres.password,
    port: configuration.postgres.port,
    username: configuration.postgres.username,
  })
  const platform = BunServices.layer
  const checker = ListingAvailabilityCheckerLive.pipe(Layer.provide(platform))
  const crud = RegistryCrudLive.pipe(Layer.provide(postgres))
  const events = makeNatsRegistryEventPublisherLayer(
    makeRegistryEventPublisherConfiguration({
      nats: {
        clientName: 'application-registry-listing-check-runner',
        maxReconnectAttempts: 10,
        password: Redacted.value(configuration.nats.password),
        server: configuration.nats.server,
        username: configuration.nats.username,
      },
    })
  )

  return ScheduledListingChecksRunnerLive.pipe(
    Layer.provide(Layer.mergeAll(crud, checker, events))
  )
}

const program = Effect.gen(function* () {
  const configuration = yield* readRunnerConfiguration
  const result = yield* ScheduledListingChecksRunner.pipe(
    Effect.flatMap((runner) =>
      runner.runOnce({
        limit: configuration.limit,
        mode: configuration.mode,
      })
    ),
    Effect.timeout('18 minutes'),
    Effect.provide(makeRuntimeLayer(configuration))
  )

  yield* Console.log(
    JSON.stringify({
      checkedCount: result.checks.length,
      runId: result.run?.id ?? null,
      state: result.run?.state ?? 'no_work',
    })
  )
})

BunRuntime.runMain(program)
