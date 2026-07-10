import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import Handlebars from 'handlebars'
import { ApplicationCampaignTemplateError } from './errors'
import { sourceDirectory } from './paths'

const templatePath = (templateName: string) =>
  Path.pipe(
    Effect.map((path) =>
      path.resolve(sourceDirectory, '../templates', templateName)
    )
  )

const readTemplate = ({
  purpose,
  templateName,
}: {
  readonly purpose: string
  readonly templateName: string
}) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const path = yield* templatePath(templateName)

    return yield* fileSystem.readFileString(path).pipe(
      Effect.mapError(
        (cause) =>
          new ApplicationCampaignTemplateError({
            cause,
            message: `Could not read ${purpose} template ${path}`,
            templatePath: path,
          })
      )
    )
  })

export const renderTemplate = <Context>({
  context,
  purpose,
  templateName,
}: {
  readonly context: Context
  readonly purpose: string
  readonly templateName: string
}) =>
  Effect.gen(function* () {
    const path = yield* templatePath(templateName)
    const template = yield* readTemplate({ purpose, templateName })

    return yield* Effect.try({
      try: () =>
        Handlebars.compile<Context>(template, {
          noEscape: true,
          strict: true,
        })(context),
      catch: (cause) =>
        new ApplicationCampaignTemplateError({
          cause,
          message: `Could not render ${purpose} template ${path}`,
          templatePath: path,
        }),
    })
  })
