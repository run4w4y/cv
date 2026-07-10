import { Codex, type CodexOptions, type ThreadOptions } from '@openai/codex-sdk'
import { Context, Effect, Layer, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import type { CodexReasoningEffort } from '../config/model'
import {
  ApplicationCampaignAiError,
  type ApplicationCampaignValidationError,
} from '../errors'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'
import {
  parseCampaignProfileShortlistEffect,
  parseCampaignRecommendationEffect,
} from './recommendation'
import {
  type CampaignProfileShortlist,
  CampaignProfileShortlistSchema,
  type CampaignRecommendation,
  CampaignRecommendationSchema,
} from './schema'

export type ApplicationAdvisorRequest = {
  readonly allowedProfiles: readonly string[]
  readonly fixedProfile?: string
  readonly prompt: string
}

type CodexRunRequest = {
  readonly operation: string
  readonly outputSchema: unknown
  readonly prompt: string
}

export type CodexApplicationAdvisorOptions = {
  readonly binaryPath?: string
  readonly model: string
  readonly reasoningEffort: CodexReasoningEffort
}

export class ApplicationAdvisor extends Context.Service<
  ApplicationAdvisor,
  {
    readonly shortlistProfiles: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignProfileShortlist,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
    readonly recommend: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignRecommendation,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
  }
>()('ApplicationAdvisor') {}

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

type ProcessEnvironment = Readonly<Record<string, string | undefined>>

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
  options: CodexApplicationAdvisorOptions,
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
    history: {
      persistence: 'none',
    },
    shell_environment_policy: {
      experimental_use_profile: false,
      ignore_default_excludes: false,
      inherit: 'none',
    },
  },
  env: buildCodexProcessEnv(isolatedCodexHome, environment),
})

export const buildCodexThreadOptions = (
  options: CodexApplicationAdvisorOptions,
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

const outputSchema = <A>(schema: Schema.Schema<A>) =>
  Schema.toJsonSchemaDocument(schema).schema

const profileShortlistOutputSchema = outputSchema(
  CampaignProfileShortlistSchema
)
const recommendationOutputSchema = outputSchema(CampaignRecommendationSchema)

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
  options: CodexApplicationAdvisorOptions,
  request: CodexRunRequest,
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

export const makeCodexApplicationAdvisorLayer = (
  options: CodexApplicationAdvisorOptions
) =>
  Layer.effect(
    ApplicationAdvisor,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem
      const path = yield* Path

      return {
        shortlistProfiles: (request: ApplicationAdvisorRequest) =>
          Effect.gen(function* () {
            yield* logInfo('Asking Codex to shortlist application profiles', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              promptChars: request.prompt.length,
              reasoningEffort: options.reasoningEffort,
            })

            const rawShortlist = yield* runCodex(fileSystem, path, options, {
              operation: 'application profile shortlist',
              outputSchema: profileShortlistOutputSchema,
              prompt: request.prompt,
            })

            yield* logDebug('Received Codex profile shortlist response', {
              responseChars: rawShortlist.length,
            })

            const shortlist = yield* parseCampaignProfileShortlistEffect(
              rawShortlist,
              {
                allowedProfiles: request.allowedProfiles,
                fixedProfile: request.fixedProfile,
              }
            )

            yield* logInfo('Codex requested full profile context', {
              requestedProfiles: shortlist.profileShortlist
                .map((item) => item.profile)
                .join(', '),
              requestedProfileCount: shortlist.profileShortlist.length,
            })

            return shortlist
          }).pipe(
            withTelemetrySpan('application-campaign.advisor.shortlist', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              reasoningEffort: options.reasoningEffort,
            })
          ),
        recommend: (request: ApplicationAdvisorRequest) =>
          Effect.gen(function* () {
            yield* logInfo('Asking Codex for application recommendation', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              promptChars: request.prompt.length,
              reasoningEffort: options.reasoningEffort,
            })

            const rawRecommendation = yield* runCodex(
              fileSystem,
              path,
              options,
              {
                operation: 'application recommendation',
                outputSchema: recommendationOutputSchema,
                prompt: request.prompt,
              }
            )

            yield* logDebug('Received Codex recommendation response', {
              responseChars: rawRecommendation.length,
            })

            const recommendation = yield* parseCampaignRecommendationEffect(
              rawRecommendation,
              {
                allowedProfiles: request.allowedProfiles,
                fixedProfile: request.fixedProfile,
              }
            )

            yield* logInfo('Codex selected application profile', {
              confidence: recommendation.recommendation.confidence,
              profile: recommendation.recommendation.profile,
            })

            return recommendation
          }).pipe(
            withTelemetrySpan('application-campaign.advisor.recommend', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              reasoningEffort: options.reasoningEffort,
            })
          ),
      }
    })
  )
