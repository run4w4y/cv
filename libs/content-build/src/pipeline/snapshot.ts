import { join } from 'node:path'
import {
  type ContentContract,
  type ContentRegistry,
  type ContentRepository,
  composeContent,
} from '@cv/content-composer'
import {
  type ContentManifest,
  type ContentVariablesSource,
  decodeContentManifest,
  type Locale,
  type ProfileSlug,
} from '@cv/content-core'
import type {
  PrivateCryptoError,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import type { PrivateRuntimeBuildInput } from '@cv/private-content-protocol'
import { Effect } from 'effect'
import type { FileSystem } from 'effect/FileSystem'
import type { Path } from 'effect/Path'
import {
  type ContentBuildConfig,
  type PrivateContentBuildSecrets,
  resolveContentBuildConfig,
} from '../config'
import {
  type ContentBuildFileSystemError,
  ContentBuildParseError,
  type ContentBuildUsageError,
} from '../errors'
import { buildInferredPrivateRuntimeInput } from '../private-runtime/runtime-input'
import {
  contentVariablesModuleDisplayPath,
  loadContentVariablesSource,
} from '../private-runtime/source'

export type PrivateContentProfileRoute = {
  lang: Locale
  profile: ProfileSlug
  profileId: string
}

/** Complete composed input used by the build artifact pipeline. */
export type ContentBuildSnapshot<Content = unknown> = {
  contentIdSalt: string
  contentFilesRoot: string
  contentRoot: string
  defaultLocale: Locale
  defaultProfileSlug: ProfileSlug
  manifest: ContentManifest<Content>
  profiles: readonly ProfileSlug[]
  privateRuntimeInput: PrivateRuntimeBuildInput | null
  privateRoutes: readonly PrivateContentProfileRoute[]
}

export type ContentBuildSource<Content = unknown> = {
  manifest: ContentManifest<Content>
  repository: ContentRepository
  variableSource: ContentVariablesSource | null
}

export type BuildContentSnapshotOptions = {
  config: ContentBuildConfig
  includeAllPublicProfiles?: boolean
  privateSecrets?: PrivateContentBuildSecrets | null
  strictPrivate?: boolean
}

const decodeManifest = <Content>(manifest: ContentManifest<Content>) =>
  Effect.try({
    try: () =>
      Effect.runSync(
        decodeContentManifest(manifest)
      ) as ContentManifest<Content>,
    catch: (cause) =>
      new ContentBuildParseError({
        cause,
        context: 'content manifest',
        message: 'Could not decode composed content manifest',
      }),
  })

export const buildContentSource = <Content>(
  registry: ContentRegistry,
  contract: ContentContract<Content>
): Effect.Effect<ContentBuildSource<Content>, ContentBuildParseError> =>
  Effect.try({
    try: () => composeContent(registry, contract),
    catch: (cause) =>
      new ContentBuildParseError({
        cause,
        context: 'content registry',
        message: 'Could not compose content registry',
      }),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.all({
        manifest: decodeManifest(result.manifest),
        variableSource: loadContentVariablesSource(
          registry,
          result.repository.config.contentDir
        ),
      }).pipe(
        Effect.map(({ manifest, variableSource }) => ({
          manifest,
          repository: result.repository,
          variableSource,
        }))
      )
    )
  )

const sortStrings = <T extends string>(values: readonly T[]) =>
  [...values].sort((left, right) => left.localeCompare(right))

const publicLocales = <Content>(
  manifest: ContentManifest<Content>,
  publicProfiles: ReadonlySet<ProfileSlug>,
  includeAllProfiles: boolean
) =>
  sortStrings(
    manifest.locales.filter((locale) =>
      includeAllProfiles
        ? Object.keys(manifest.content[locale] ?? {}).length > 0
        : Object.keys(manifest.content[locale] ?? {}).some((profile) =>
            publicProfiles.has(profile)
          )
    )
  )

const publicContent = <Content>(
  manifest: ContentManifest<Content>,
  publicProfiles: ReadonlySet<ProfileSlug>,
  includeAllProfiles: boolean
): Record<Locale, Record<ProfileSlug, Content>> => {
  return Object.fromEntries(
    publicLocales(manifest, publicProfiles, includeAllProfiles).map(
      (locale) => {
        const profiles = manifest.content[locale] ?? {}
        const selectedProfiles = includeAllProfiles
          ? Object.entries(profiles)
          : Object.entries(profiles).filter(([profile]) =>
              publicProfiles.has(profile)
            )

        return [
          locale,
          Object.fromEntries(
            selectedProfiles.flatMap(([profile, content]) =>
              content
                ? [[profile, content] satisfies [ProfileSlug, Content]]
                : []
            )
          ),
        ]
      }
    )
  )
}

const publicManifest = <Content>(
  manifest: ContentManifest<Content>,
  publicProfiles: ReadonlySet<ProfileSlug>,
  includeAllProfiles: boolean
): ContentManifest<Content> => {
  const locales = publicLocales(manifest, publicProfiles, includeAllProfiles)
  const content = publicContent(manifest, publicProfiles, includeAllProfiles)
  const profiles = sortStrings([
    ...new Set(locales.flatMap((locale) => Object.keys(content[locale] ?? {}))),
  ])

  return {
    content,
    contentSchema: manifest.contentSchema,
    locales,
    profiles,
    schema: manifest.schema,
  }
}

const privateRoutesFromInput = (
  input: PrivateRuntimeBuildInput | null
): PrivateContentProfileRoute[] =>
  input
    ? input.profiles.map((profile) => ({
        lang: profile.locale,
        profile: profile.profile,
        profileId: profile.id,
      }))
    : []

export const buildContentSnapshot = <Content>(
  registry: ContentRegistry,
  contract: ContentContract<Content>,
  {
    config,
    includeAllPublicProfiles = false,
    privateSecrets = null,
    strictPrivate = false,
  }: BuildContentSnapshotOptions
): Effect.Effect<
  ContentBuildSnapshot<Content>,
  | ContentBuildFileSystemError
  | ContentBuildParseError
  | ContentBuildUsageError
  | PrivateCryptoError,
  FileSystem | Path | WebCryptoApi
> =>
  buildContentSource(registry, contract).pipe(
    Effect.flatMap(({ manifest, repository, variableSource }) =>
      resolveContentBuildConfig(config).pipe(
        Effect.flatMap(({ contentIdSalt, contentRoot }) => {
          const publicProfiles = new Set(repository.config.publicProfiles)
          const contentFilesRoot = join(
            contentRoot,
            repository.config.contentDir
          )
          const variableSourcePath = contentVariablesModuleDisplayPath(
            repository.config.contentDir
          )

          return buildInferredPrivateRuntimeInput<Content>({
            contentBuildConfig: { contentIdSalt, contentRoot },
            contentFilesRoot,
            contract,
            manifest,
            privateSecrets,
            publicProfiles: repository.config.publicProfiles,
            variableSource,
            variableSourcePath,
            strict: strictPrivate,
          }).pipe(
            Effect.map((privateRuntimeInput) => ({
              contentIdSalt,
              contentFilesRoot,
              contentRoot,
              defaultLocale: repository.config.defaultLocale,
              defaultProfileSlug: repository.config.defaultProfile,
              manifest: publicManifest(
                manifest,
                publicProfiles,
                includeAllPublicProfiles
              ),
              profiles: sortStrings(manifest.profiles),
              privateRuntimeInput,
              privateRoutes: privateRoutesFromInput(privateRuntimeInput),
            }))
          )
        })
      )
    )
  )
