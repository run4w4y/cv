import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, Layer } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import { type PdfExporter, PdfExporterLive } from '../exporter'

export type PdfExportRuntime = BunServices.BunServices | PdfExporter

const PlatformLayer = Layer.merge(BunServices.layer, FetchHttpClient.layer)
const PdfExporterLayer = PdfExporterLive.pipe(Layer.provide(PlatformLayer))
const PdfExportRuntimeLayer = Layer.merge(PlatformLayer, PdfExporterLayer)

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

export const runCli = <Name extends string, Input, ContextInput, E>(
  command: Command.Command<Name, Input, ContextInput, E, PdfExportRuntime>,
  config: { readonly version: string }
) =>
  Command.run(command, config).pipe(
    Effect.catch((error) =>
      CliError.isCliError(error) ? setFailedExitCode : Effect.fail(error)
    ),
    Effect.provide(PdfExportRuntimeLayer),
    Effect.catch(reportError),
    Effect.catchDefect(reportDefect),
    BunRuntime.runMain
  )
