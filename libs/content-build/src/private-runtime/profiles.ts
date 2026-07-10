import type { ContentContract } from '@cv/content-composer'
import type {
  ContentManifest,
  ContentVariablesSource,
  Locale,
  LocalizedVariableValue,
  ProfileSlug,
  VariableValue,
} from '@cv/content-core'
import {
  deriveProfileContentKey,
  type PrivateCryptoError,
  parsePrivateContentRootKey,
  type WebCryptoApi,
} from '@cv/private-content-crypto'
import type {
  PrivateRuntimeBuildInput,
  PrivateRuntimeLocaleContent,
  PrivateSharedVariable,
} from '@cv/private-content-protocol'
import { Effect } from 'effect'
import type { ContentBuildConfig, PrivateContentBuildSecrets } from '../config'
import { ContentBuildParseError, ContentBuildUsageError } from '../errors'
import { discoverContentFileProfiles } from '../files/discovery'
import { mangleProfileId } from '../ids'
import {
  type CollectedVariable,
  collectContentVariables,
  isVariableValue,
  mergeCollectedVariableMaps,
} from './variables'

const defaultVariableSourcePath = 'content/variables.ts'

export type InferredPrivateProfile<Content = unknown> = {
  content: Content
  id: ProfileSlug
  locale: Locale
  profile: ProfileSlug
  variableIds: readonly string[]
  variables: readonly CollectedVariable[]
}

export type InferPrivateProfilesOptions<Content = unknown> = {
  contract: ContentContract<Content>
  includeProfiles?: readonly ProfileSlug[]
  manifest: ContentManifest<Content>
  publicProfiles: readonly ProfileSlug[]
}

export type InferPrivateProfilesWithConfigOptions<Content = unknown> =
  InferPrivateProfilesOptions<Content> & {
    contentBuildConfig: ContentBuildConfig
    contentFilesRoot?: string
  }

const discoverProfiles = <Content>(
  manifest: ContentManifest<Content>,
  contract: ContentContract<Content>,
  publicProfiles: ReadonlySet<ProfileSlug>,
  salt: string,
  includeProfiles: ReadonlySet<ProfileSlug> = new Set()
) => {
  const privateProfiles: InferredPrivateProfile<Content>[] = []

  for (const [locale, profiles] of Object.entries(manifest.content) as Array<
    [Locale, Record<ProfileSlug, Content>]
  >) {
    for (const [profile, content] of Object.entries(profiles) as Array<
      [ProfileSlug, Content]
    >) {
      const variables = collectContentVariables(
        content,
        locale,
        profile,
        contract
      )
      const variableIds = [...variables.keys()].sort()

      privateProfiles.push({
        content,
        id: mangleProfileId(profile, salt),
        locale,
        profile,
        variableIds,
        variables: [...variables.values()],
      })
    }
  }

  return privateProfiles.filter(
    (profile) =>
      profile.variableIds.length > 0 ||
      !publicProfiles.has(profile.profile) ||
      includeProfiles.has(profile.profile)
  )
}

export const inferPrivateProfilesWithConfig = <Content>({
  contentBuildConfig,
  contentFilesRoot,
  contract,
  includeProfiles,
  manifest,
  publicProfiles,
}: InferPrivateProfilesWithConfigOptions<Content>) =>
  Effect.gen(function* () {
    const contentFileProfiles =
      includeProfiles ??
      (yield* discoverContentFileProfiles(
        contentFilesRoot ?? contentBuildConfig.contentRoot,
        manifest.profiles
      ))

    return yield* Effect.try({
      try: () =>
        discoverProfiles(
          manifest,
          contract,
          new Set(publicProfiles),
          contentBuildConfig.contentIdSalt,
          new Set(contentFileProfiles)
        ),
      catch: (cause) =>
        new ContentBuildParseError({
          cause,
          context: 'content profiles',
          message: 'Could not infer private profiles from content profiles',
        }),
    })
  })

const mergeVariablesFromProfiles = (
  profiles: readonly InferredPrivateProfile[]
) =>
  [
    ...mergeCollectedVariableMaps(
      ...profiles.map(
        (profile) =>
          new Map(profile.variables.map((variable) => [variable.id, variable]))
      )
    ).values(),
  ].sort((left, right) => left.id.localeCompare(right.id))

const variableValue = (
  variable: CollectedVariable,
  variableSource: ContentVariablesSource | null,
  variableSourcePath: string
) =>
  Effect.gen(function* () {
    const value: Record<Locale, VariableValue> = {}

    for (const locale of [...variable.locales].sort()) {
      value[locale] = yield* resolveContentVariableValue(
        variableSource,
        variable.id,
        locale,
        variableSourcePath
      )
    }

    return value
  })

export const profileVariables = (
  profile: InferredPrivateProfile,
  variableSource: ContentVariablesSource | null,
  variableSourcePath = defaultVariableSourcePath
) =>
  Effect.forEach(
    [...profile.variables].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    (variable) =>
      Effect.gen(function* () {
        return {
          description: [...variable.descriptions].join(' / '),
          id: variable.id,
          value: yield* variableValue(
            variable,
            variableSource,
            variableSourcePath
          ),
        } satisfies PrivateSharedVariable
      })
  )

export const validateProfileVariables = (
  profiles: readonly InferredPrivateProfile[],
  variableSource: ContentVariablesSource | null,
  variableSourcePath = defaultVariableSourcePath
) =>
  validateVariableSource(
    mergeVariablesFromProfiles(profiles),
    variableSource,
    variableSourcePath
  )

const variableSourceValue = (
  variableSource: ContentVariablesSource | null,
  variable: string
): LocalizedVariableValue | undefined => variableSource?.variables[variable]

const validateVariableSource = (
  variables: readonly CollectedVariable[],
  variableSource: ContentVariablesSource | null,
  variableSourcePath: string
) => {
  const referencedIds = new Set(variables.map((variable) => variable.id))

  if (referencedIds.size === 0) {
    return Effect.void
  }

  if (!variableSource) {
    return ContentBuildUsageError.fail(
      `Missing ${variableSourcePath}. Define content variable values for: ${[
        ...referencedIds,
      ].join(', ')}`
    )
  }

  return Effect.void
}

export const resolveContentVariableValue = (
  variableSource: ContentVariablesSource | null,
  variable: string,
  locale: Locale,
  variableSourcePath = defaultVariableSourcePath
) =>
  Effect.gen(function* () {
    const sourceValue = variableSourceValue(variableSource, variable)

    if (!sourceValue) {
      return yield* ContentBuildUsageError.fail(
        `Missing content variable value for ${variable} (${locale}) in ${variableSourcePath}.`
      )
    }

    const value = isVariableValue(sourceValue)
      ? sourceValue
      : sourceValue[locale]

    if (!value) {
      return yield* ContentBuildUsageError.fail(
        `Missing content variable value for ${variable} (${locale}) in ${variableSourcePath}.`
      )
    }

    if (typeof value === 'string') {
      if (value.trim().length === 0) {
        return yield* ContentBuildUsageError.fail(
          `Content variable value for ${variable} (${locale}) must not be empty.`
        )
      }

      return value
    }

    if (value.length === 0 || value.some((line) => line.trim().length === 0)) {
      return yield* ContentBuildUsageError.fail(
        `Content variable lines for ${variable} (${locale}) must not be empty.`
      )
    }

    return value
  })

export const runtimeProfilesFromInferredProfiles = <Content>(
  profiles: readonly InferredPrivateProfile<Content>[],
  variableSource: ContentVariablesSource | null,
  secrets: PrivateContentBuildSecrets,
  variableSourcePath = defaultVariableSourcePath
): Effect.Effect<
  readonly PrivateRuntimeBuildInput['profiles'][number][],
  ContentBuildUsageError | PrivateCryptoError,
  WebCryptoApi
> =>
  Effect.gen(function* () {
    const rootKey = yield* parsePrivateContentRootKey(secrets.rootKey)

    return yield* Effect.forEach(profiles, (profile) =>
      Effect.gen(function* () {
        const content: Record<Locale, PrivateRuntimeLocaleContent> = {
          [profile.locale]: profile.content as PrivateRuntimeLocaleContent,
        }

        return {
          content,
          contentKey: yield* deriveProfileContentKey({
            profileId: profile.id,
            rootKey,
          }),
          id: profile.id,
          locale: profile.locale,
          profile: profile.profile,
          variables: yield* profileVariables(
            profile,
            variableSource,
            variableSourcePath
          ),
        } satisfies PrivateRuntimeBuildInput['profiles'][number]
      })
    )
  })
