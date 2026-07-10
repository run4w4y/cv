import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import {
  type ApplicationCampaignRuntime,
  ApplicationCampaignRuntimeLayer,
} from '../runtime'
import { withTelemetrySpan } from '../telemetry'

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
  command: Command.Command<
    Name,
    Input,
    ContextInput,
    E,
    ApplicationCampaignRuntime
  >,
  config: { readonly version: string }
) =>
  Command.run(command, config).pipe(
    withTelemetrySpan('application-campaign.cli', {
      tool: 'application-campaign',
    }),
    Effect.catch((error) =>
      CliError.isCliError(error) ? setFailedExitCode : Effect.fail(error)
    ),
    Effect.provide(ApplicationCampaignRuntimeLayer),
    Effect.catch(reportError),
    Effect.catchDefect(reportDefect),
    BunRuntime.runMain
  )
