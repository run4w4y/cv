import { webBaseUrlSchema } from '@cv/content-core'
import { Config, Effect, Option } from 'effect'
import { Flag } from 'effect/unstable/cli'
import { PdfUsageError } from '../errors'

export const webBaseUrlFlag = Flag.string('base-url').pipe(
  Flag.withSchema(webBaseUrlSchema),
  Flag.withDescription(
    'Deployed CV base URL to encode into print QR codes and PDF links.'
  ),
  Flag.optional
)

export const resolveWebBaseUrl = (requested: Option.Option<URL>) =>
  Option.match(requested, {
    onNone: () =>
      Config.schema(webBaseUrlSchema, 'CV_WEB_BASE_URL').pipe(
        Config.option,
        Effect.map(Option.getOrUndefined),
        Effect.mapError(PdfUsageError.fromConfigError)
      ),
    onSome: (url) => Effect.succeed(url),
  })
