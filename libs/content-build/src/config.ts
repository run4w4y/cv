import {
  type ContentBuildConfig,
  contentBuildConfigSchema,
  type PrivateContentBuildSecrets,
  privateContentBuildSecretsSchema,
} from '@cv/private-content-config'
import { Effect, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import { ContentBuildFileSystemError, ContentBuildUsageError } from './errors'

export type { ContentBuildConfig, PrivateContentBuildSecrets }
export { contentBuildConfigSchema, privateContentBuildSecretsSchema }

const decodeContentBuildConfig = Schema.decodeUnknownEffect(
  contentBuildConfigSchema,
  { errors: 'all' }
)

const parseContentBuildConfig = (config: ContentBuildConfig) =>
  decodeContentBuildConfig(config).pipe(
    Effect.mapError(
      (cause) =>
        new ContentBuildUsageError({
          message: `Invalid content build config: ${cause.message}`,
        })
    )
  )

const assertContentRootDirectory = (
  contentRoot: string
): Effect.Effect<
  string,
  ContentBuildFileSystemError | ContentBuildUsageError,
  FileSystem
> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.exists(contentRoot).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'check',
              path: contentRoot,
            })
        ),
        Effect.flatMap((exists) =>
          exists
            ? fileSystem.stat(contentRoot).pipe(
                Effect.mapError(
                  (cause) =>
                    new ContentBuildFileSystemError({
                      cause,
                      operation: 'stat',
                      path: contentRoot,
                    })
                ),
                Effect.flatMap((info) =>
                  info.type === 'Directory'
                    ? Effect.succeed(contentRoot)
                    : Effect.fail(
                        new ContentBuildUsageError({
                          message:
                            'contentRoot must point to an existing directory',
                        })
                      )
                )
              )
            : Effect.fail(
                new ContentBuildUsageError({
                  message: 'contentRoot must point to an existing directory',
                })
              )
        )
      )
    )
  )

export const resolveContentBuildConfig = (
  config: ContentBuildConfig
): Effect.Effect<
  ContentBuildConfig,
  ContentBuildFileSystemError | ContentBuildUsageError,
  FileSystem | Path
> =>
  Effect.gen(function* () {
    const parsed = yield* parseContentBuildConfig(config)
    const path = yield* Path
    const resolvedContentRoot = path.resolve(parsed.contentRoot)

    return {
      contentIdSalt: parsed.contentIdSalt,
      contentRoot: yield* assertContentRootDirectory(resolvedContentRoot),
    }
  })
