import { Codex, type CodexOptions, type ThreadOptions } from '@openai/codex-sdk'
import { Context, Effect, Layer, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import type { CodexReasoningEffort } from '../config/model'
import {
  ApplicationCampaignAiError,
  ApplicationCampaignValidationError,
} from '../errors'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'

export type CodexStructuredAiOptions = {
  readonly binaryPath?: string
  readonly model: string
  readonly reasoningEffort: CodexReasoningEffort
}

export type StructuredAiRequest<A> = {
  readonly operation: string
  readonly prompt: string
  readonly schema: Schema.ConstraintDecoder<A, never>
}

export type StructuredAiService = {
  readonly run: <A>(
    request: StructuredAiRequest<A>
  ) => Effect.Effect<
    A,
    ApplicationCampaignAiError | ApplicationCampaignValidationError
  >
}

export class StructuredAi extends Context.Service<
  StructuredAi,
  StructuredAiService
>()('@cv/application-campaign/StructuredAi') {}

const codexEnvironmentKeys = [
  'CODEX_ACCESS_TOKEN',
  'CODEX_API_KEY',
  'CODEX_CA_CERTIFICATE',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NIX_SSL_CERT_FILE',
  'PATH',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TERM',
  'TMPDIR',
] as const

export type ProcessEnvironment = Readonly<Record<string, string | undefined>>

export const buildCodexProcessEnv = (
  isolatedCodexHome: string,
  environment: ProcessEnvironment = process.env
): Record<string, string> => ({
  ...Object.fromEntries(
    codexEnvironmentKeys.flatMap((key) => {
      const value = environment[key]

      return value ? [[key, value] as const] : []
    })
  ),
  CODEX_HOME: isolatedCodexHome,
  HOME: isolatedCodexHome,
})

export const buildCodexOptions = (
  options: CodexStructuredAiOptions,
  isolatedCodexHome: string,
  environment: ProcessEnvironment = process.env
): CodexOptions => ({
  ...(options.binaryPath ? { codexPathOverride: options.binaryPath } : {}),
  config: {
    features: {
      shell_snapshot: false,
      shell_tool: false,
      skill_mcp_dependency_install: false,
      unified_exec: false,
    },
    history: { persistence: 'none' },
    shell_environment_policy: {
      experimental_use_profile: false,
      ignore_default_excludes: false,
      inherit: 'none',
    },
  },
  env: buildCodexProcessEnv(isolatedCodexHome, environment),
})

export const buildCodexThreadOptions = (
  options: CodexStructuredAiOptions,
  workingDirectory: string
): ThreadOptions => ({
  approvalPolicy: 'never' as const,
  model: options.model,
  modelReasoningEffort: options.reasoningEffort,
  networkAccessEnabled: false,
  sandboxMode: 'read-only' as const,
  skipGitRepoCheck: true,
  webSearchMode: 'disabled' as const,
  workingDirectory,
})

const formatAiErrorCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

const seedCodexAuthentication = (
  fileSystem: FileSystem,
  path: Path,
  isolatedCodexHome: string,
  environment: ProcessEnvironment
) =>
  Effect.gen(function* () {
    if (environment.CODEX_ACCESS_TOKEN || environment.CODEX_API_KEY) {
      return
    }

    const parentHome = environment.CODEX_HOME
      ? environment.CODEX_HOME
      : environment.HOME
        ? path.join(environment.HOME, '.codex')
        : undefined

    if (!parentHome) {
      return
    }

    const source = path.join(parentHome, 'auth.json')
    if (!(yield* fileSystem.exists(source))) {
      return
    }

    const destination = path.join(isolatedCodexHome, 'auth.json')
    yield* fileSystem.copyFile(source, destination)
    yield* fileSystem.chmod(destination, 0o600)
  })

const runCodex = (
  fileSystem: FileSystem,
  path: Path,
  options: CodexStructuredAiOptions,
  request: {
    readonly operation: string
    readonly outputSchema: unknown
    readonly prompt: string
  },
  environment: ProcessEnvironment = process.env
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtimeDirectory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: 'cv-application-campaign-codex-',
      })
      const isolatedCodexHome = path.join(runtimeDirectory, 'home')
      const workingDirectory = path.join(runtimeDirectory, 'workspace')

      yield* Effect.all([
        fileSystem.makeDirectory(isolatedCodexHome),
        fileSystem.makeDirectory(workingDirectory),
      ])
      yield* seedCodexAuthentication(
        fileSystem,
        path,
        isolatedCodexHome,
        environment
      )

      return yield* Effect.tryPromise({
        try: async () => {
          const codex = new Codex(
            buildCodexOptions(options, isolatedCodexHome, environment)
          )
          const thread = codex.startThread(
            buildCodexThreadOptions(options, workingDirectory)
          )
          const turn = await thread.run(request.prompt, {
            outputSchema: request.outputSchema,
          })

          return turn.finalResponse.trim()
        },
        catch: (cause) =>
          new ApplicationCampaignAiError({
            cause,
            message: [
              `Could not get ${request.operation} from Codex:`,
              formatAiErrorCause(cause),
            ].join(' '),
          }),
      })
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof ApplicationCampaignAiError
          ? cause
          : new ApplicationCampaignAiError({
              cause,
              message: `Could not prepare isolated Codex runtime: ${formatAiErrorCause(cause)}`,
            })
      )
    )
  )

export const makeCodexStructuredAiLayer = (options: CodexStructuredAiOptions) =>
  Layer.effect(
    StructuredAi,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem
      const path = yield* Path

      return {
        run: <A>(request: StructuredAiRequest<A>) =>
          Effect.gen(function* () {
            yield* logInfo('Requesting structured Codex output', {
              model: options.model,
              operation: request.operation,
              promptChars: request.prompt.length,
              reasoningEffort: options.reasoningEffort,
            })
            const raw = yield* runCodex(fileSystem, path, options, {
              operation: request.operation,
              outputSchema: Schema.toJsonSchemaDocument(request.schema).schema,
              prompt: request.prompt,
            })
            yield* logDebug('Received structured Codex output', {
              operation: request.operation,
              responseChars: raw.length,
            })

            return yield* Schema.decodeUnknownEffect(
              Schema.fromJsonString(request.schema),
              { errors: 'all' }
            )(raw).pipe(
              Effect.mapError(
                (cause) =>
                  new ApplicationCampaignValidationError({
                    cause,
                    message: `Could not decode ${request.operation}`,
                  })
              )
            )
          }).pipe(
            withTelemetrySpan('application-campaign.ai.structured', {
              model: options.model,
              operation: request.operation,
              reasoningEffort: options.reasoningEffort,
            })
          ),
      } satisfies StructuredAiService
    })
  )
