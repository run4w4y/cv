import {
  type ContentRegistry,
  readOptionalContentModule,
} from '@cv/content-composer'
import {
  type ContentVariablesSource,
  contentVariablesSourceSchema,
} from '@cv/content-core'
import { Effect, Schema } from 'effect'
import { ContentBuildParseError } from '../errors'

const normalizeContentDirectory = (contentDir: string) =>
  contentDir.replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '')

export const contentVariablesModulePath = (contentDir: string) =>
  [normalizeContentDirectory(contentDir), 'variables'].filter(Boolean).join('/')

export const contentVariablesModuleDisplayPath = (contentDir: string) =>
  `${contentVariablesModulePath(contentDir)}.ts`

const decodeContentVariables = Schema.decodeUnknownSync(
  contentVariablesSourceSchema,
  {
    errors: 'all',
  }
)

export const loadContentVariablesSource = (
  registry: ContentRegistry,
  contentDir: string
): Effect.Effect<ContentVariablesSource | null, ContentBuildParseError> =>
  Effect.try({
    try: () => {
      const variablesModulePath = contentVariablesModulePath(contentDir)
      const source = readOptionalContentModule<unknown>(
        variablesModulePath,
        registry
      )

      return source ? decodeContentVariables(source.data) : null
    },
    catch: (cause) => {
      const variablesPath = contentVariablesModuleDisplayPath(contentDir)

      return new ContentBuildParseError({
        cause,
        context: variablesPath,
        message: `Could not load content variables from ${variablesPath}. Expected a default export satisfying ContentVariablesSource.`,
      })
    },
  })
