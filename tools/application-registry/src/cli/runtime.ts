import { BunRuntime, BunServices } from '@effect/platform-bun'
import {
  type ListingAvailabilityChecker,
  ListingAvailabilityCheckerLive,
} from '@cv/application-registry-listing-check'
import { Console, Effect, Layer } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import {
  ApplicationRegistryClient,
  type ApplicationRegistryClientService,
  makeApplicationRegistryClientLayer,
} from '../client'
import { readApplicationRegistryClientConfig } from '../config'

export type ApplicationRegistryRuntime =
  | BunServices.BunServices
  | ApplicationRegistryClient
  | ListingAvailabilityChecker

const PlatformLayer = Layer.merge(BunServices.layer, FetchHttpClient.layer)

const withConfiguredRegistryClient = <A, E>(
  use: (client: ApplicationRegistryClientService) => Effect.Effect<A, E>
) =>
  readApplicationRegistryClientConfig.pipe(
    Effect.flatMap((config) =>
      ApplicationRegistryClient.pipe(Effect.flatMap(use)).pipe(
        Effect.provide(makeApplicationRegistryClientLayer(config)),
        Effect.provide(PlatformLayer)
      )
    )
  )

const DeferredRegistryClientLayer = Layer.succeed(ApplicationRegistryClient, {
  addNote: (identifier, request) =>
    withConfiguredRegistryClient((client) =>
      client.addNote(identifier, request)
    ),
  annotations: (identifier) =>
    withConfiguredRegistryClient((client) => client.annotations(identifier)),
  appendEvent: (identifier, request) =>
    withConfiguredRegistryClient((client) =>
      client.appendEvent(identifier, request)
    ),
  capture: (request) =>
    withConfiguredRegistryClient((client) => client.capture(request)),
  captures: (identifier) =>
    withConfiguredRegistryClient((client) => client.captures(identifier)),
  compensations: (identifier, query) =>
    withConfiguredRegistryClient((client) =>
      client.compensations(identifier, query)
    ),
  events: (identifier) =>
    withConfiguredRegistryClient((client) => client.events(identifier)),
  list: (query) => withConfiguredRegistryClient((client) => client.list(query)),
  show: (identifier) =>
    withConfiguredRegistryClient((client) => client.show(identifier)),
  submitListingCheckFindings: (batchId, request) =>
    withConfiguredRegistryClient((client) =>
      client.submitListingCheckFindings(batchId, request)
    ),
  sync: () => withConfiguredRegistryClient((client) => client.sync()),
} satisfies ApplicationRegistryClientService)

const ApplicationRegistryRuntimeLayer = Layer.mergeAll(
  PlatformLayer,
  DeferredRegistryClientLayer,
  ListingAvailabilityCheckerLive
)

const setFailedExitCode = Effect.sync(() => {
  process.exitCode = 1
})

const formatError = (error: unknown, includeStack = false) =>
  error instanceof Error
    ? includeStack
      ? (error.stack ?? error.message)
      : error.message
    : String(error)

const reportError = (error: unknown) =>
  Console.error(formatError(error)).pipe(Effect.andThen(setFailedExitCode))

const reportDefect = (defect: unknown) =>
  Console.error(formatError(defect, true)).pipe(
    Effect.andThen(setFailedExitCode)
  )

export const runApplicationRegistryCli = <
  Name extends string,
  Input,
  ContextInput,
  E,
>(
  command: Command.Command<
    Name,
    Input,
    ContextInput,
    E,
    ApplicationRegistryRuntime
  >,
  config: { readonly version: string }
) =>
  Command.run(command, config).pipe(
    Effect.catch((error) =>
      CliError.isCliError(error) ? setFailedExitCode : Effect.fail(error)
    ),
    Effect.provide(ApplicationRegistryRuntimeLayer),
    Effect.catch(reportError),
    Effect.catchDefect(reportDefect),
    BunRuntime.runMain
  )
