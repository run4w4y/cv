import type { ContentContract } from '@cv/content-composer'
import type {
  ContentManifest,
  ContentVariablesSource,
  ProfileSlug,
} from '@cv/content-core'
import type {
  PrivateCryptoError,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import type { PrivateRuntimeBuildInput } from '@cv/private-content-protocol'
import { Effect } from 'effect'
import type { FileSystem } from 'effect/FileSystem'
import type { ContentBuildConfig, PrivateContentBuildSecrets } from '../config'
import {
  type ContentBuildFileSystemError,
  type ContentBuildParseError,
  ContentBuildUsageError,
} from '../errors'
import {
  type InferredPrivateProfile,
  inferPrivateProfilesWithConfig,
  runtimeProfilesFromInferredProfiles,
  validateProfileVariables,
} from './profiles'

export type BuildInferredPrivateInputOptions<Content = unknown> = {
  contentBuildConfig: ContentBuildConfig
  contentFilesRoot?: string
  contract: ContentContract<Content>
  includeProfiles?: readonly ProfileSlug[]
  manifest: ContentManifest<Content>
  privateSecrets?: PrivateContentBuildSecrets | null
  publicProfiles: readonly ProfileSlug[]
  variableSource?: ContentVariablesSource | null
  variableSourcePath?: string
  strict?: boolean
}

const defaultVariableSourcePath = 'content/variables.ts'

const buildRuntimeInput = <Content>(
  profiles: readonly InferredPrivateProfile<Content>[],
  secrets: PrivateContentBuildSecrets,
  variableSource: ContentVariablesSource | null,
  variableSourcePath: string
): Effect.Effect<
  PrivateRuntimeBuildInput,
  ContentBuildUsageError | PrivateCryptoError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    yield* validateProfileVariables(
      profiles,
      variableSource,
      variableSourcePath
    )

    const runtimeProfiles = yield* runtimeProfilesFromInferredProfiles(
      profiles,
      variableSource,
      secrets,
      variableSourcePath
    )

    return {
      profiles: runtimeProfiles,
    } satisfies PrivateRuntimeBuildInput
  })

export const buildInferredPrivateRuntimeInput = <Content>({
  contentBuildConfig,
  contentFilesRoot,
  contract,
  includeProfiles,
  manifest,
  privateSecrets = null,
  publicProfiles,
  variableSource = null,
  variableSourcePath = defaultVariableSourcePath,
  strict = false,
}: BuildInferredPrivateInputOptions<Content>): Effect.Effect<
  PrivateRuntimeBuildInput | null,
  | ContentBuildFileSystemError
  | ContentBuildParseError
  | ContentBuildUsageError
  | PrivateCryptoError,
  FileSystem | WebCryptoApi
> =>
  Effect.gen(function* () {
    if (!privateSecrets) {
      return strict
        ? yield* ContentBuildUsageError.fail(
            'Private content secrets were not supplied.'
          )
        : null
    }

    const profiles = yield* inferPrivateProfilesWithConfig({
      contentBuildConfig,
      contentFilesRoot,
      contract,
      includeProfiles,
      manifest,
      publicProfiles,
    })

    if (profiles.length === 0) {
      return strict
        ? yield* ContentBuildUsageError.fail(
            'No private content profiles were inferred from content profiles.'
          )
        : null
    }

    return yield* buildRuntimeInput(
      profiles,
      privateSecrets,
      variableSource,
      variableSourcePath
    )
  })
