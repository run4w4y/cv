import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, Layer } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import type * as HttpClient from 'effect/unstable/http/HttpClient'

export type PdfExportRuntime = BunServices.BunServices | HttpClient.HttpClient

const PdfExportRuntimeLayer = Layer.mergeAll(
  BunServices.layer,
  FetchHttpClient.layer
)

export type CliConfig = {
  readonly version: string
}

const setFailedExitCode = Effect.sync(() => {
  process.exitCode = 1
})

const formatUnknownError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const formatUnknownDefect = (defect: unknown) =>
  defect instanceof Error ? (defect.stack ?? defect.message) : String(defect)

export const reportError = (error: unknown) =>
  Console.error(formatUnknownError(error)).pipe(
    Effect.andThen(setFailedExitCode)
  )

const reportDefect = (defect: unknown) =>
  Console.error(formatUnknownDefect(defect)).pipe(
    Effect.andThen(setFailedExitCode)
  )

export const runMain = <A, E>(program: Effect.Effect<A, E, PdfExportRuntime>) =>
  program.pipe(
    Effect.map(() => undefined),
    Effect.provide(PdfExportRuntimeLayer),
    Effect.catch(reportError),
    Effect.catchDefect(reportDefect),
    BunRuntime.runMain
  )

export const runCli = <Name extends string, Input, ContextInput, E>(
  command: Command.Command<Name, Input, ContextInput, E, PdfExportRuntime>,
  config: CliConfig
) =>
  Effect.suspend(() =>
    Command.runWith(command, config)(process.argv.slice(2))
  ).pipe(
    Effect.catch((error) =>
      CliError.isCliError(error) ? setFailedExitCode : Effect.fail(error)
    ),
    Effect.provide(PdfExportRuntimeLayer),
    Effect.catch(reportError),
    Effect.catchDefect(reportDefect),
    BunRuntime.runMain
  )
