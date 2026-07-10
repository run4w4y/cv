import { WebCryptoApiLayer } from '@cv/private-content-crypto'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, Layer } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import {
  type PrivateContentLink,
  PrivateContentLinkLive,
} from '../private-link'

export type PrivateContentLinkRuntime =
  | BunServices.BunServices
  | PrivateContentLink

const PrivateContentLinkServiceLayer = PrivateContentLinkLive.pipe(
  Layer.provide(WebCryptoApiLayer)
)

const PrivateContentLinkRuntimeLayer = Layer.merge(
  BunServices.layer,
  PrivateContentLinkServiceLayer
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

const reportUnknownError = (error: unknown) =>
  Console.error(formatUnknownError(error)).pipe(
    Effect.andThen(setFailedExitCode)
  )

const reportUnknownDefect = (defect: unknown) =>
  Console.error(formatUnknownDefect(defect)).pipe(
    Effect.andThen(setFailedExitCode)
  )

export const runCli = <Name extends string, Input, ContextInput, E>(
  command: Command.Command<
    Name,
    Input,
    ContextInput,
    E,
    PrivateContentLinkRuntime
  >,
  config: CliConfig
) =>
  Command.run(command, config).pipe(
    Effect.catch((error) =>
      CliError.isCliError(error) ? setFailedExitCode : Effect.fail(error)
    ),
    Effect.provide(PrivateContentLinkRuntimeLayer),
    Effect.catch(reportUnknownError),
    Effect.catchDefect(reportUnknownDefect),
    BunRuntime.runMain
  )
