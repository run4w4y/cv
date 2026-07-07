import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import Handlebars from 'handlebars'
import { ContentTypesFileSystemError } from './errors'

export type DeclarationTemplateContext = {
  readonly authoringDeclarations: string
  readonly componentExports: string
  readonly contentDeclarations: string
}

const sourceDirectory = fileURLToPath(new URL('.', import.meta.url))
const declarationTemplateName = 'content-authoring.d.ts.hbs-template'

const templatePath = () =>
  Path.pipe(
    Effect.map((path) =>
      path.resolve(sourceDirectory, '../templates', declarationTemplateName)
    )
  )

const readDeclarationTemplate = Effect.gen(function* () {
  const path = yield* templatePath()
  const fileSystem = yield* FileSystem

  return yield* fileSystem.readFileString(path).pipe(
    Effect.mapError(
      (cause) =>
        new ContentTypesFileSystemError({
          cause,
          operation: 'read',
          path,
        })
    )
  )
})

export const renderDeclarationTemplate = (
  context: DeclarationTemplateContext
) =>
  Effect.gen(function* () {
    const template = yield* readDeclarationTemplate

    return Handlebars.compile<DeclarationTemplateContext>(template, {
      noEscape: true,
      strict: true,
    })(context)
  })

export const writeDeclarationFile = (outputPath: string, source: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const path = yield* Path

    yield* fileSystem
      .makeDirectory(path.dirname(outputPath), { recursive: true })
      .pipe(
        Effect.mapError(
          (cause) =>
            new ContentTypesFileSystemError({
              cause,
              operation: 'create directory for',
              path: outputPath,
            })
        )
      )

    return yield* fileSystem.writeFileString(outputPath, source).pipe(
      Effect.mapError(
        (cause) =>
          new ContentTypesFileSystemError({
            cause,
            operation: 'write',
            path: outputPath,
          })
      )
    )
  })
