import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { exportPublicPdfs } from '../exporter'
import { resolveWebBaseUrl, webBaseUrlFlag } from './config'
import { runCli } from './runtime'

const publishedPublicLocales = ['en', 'ru'] as const

const locale = Flag.string('locale').pipe(
  Flag.withDescription(
    'Public CV locale to render. Defaults to all published public locales.'
  ),
  Flag.optional
)
const skipBuild = Flag.boolean('skip-build').pipe(
  Flag.withDescription('Reuse an existing CV build instead of rebuilding.')
)

export const publicPdfCommand = Command.make(
  'public',
  { baseUrl: webBaseUrlFlag, locale, skipBuild },
  (options) =>
    Effect.gen(function* () {
      const webBaseUrl = yield* resolveWebBaseUrl(options.baseUrl)
      const results = yield* exportPublicPdfs({
        locales: Option.match(options.locale, {
          onNone: () => publishedPublicLocales,
          onSome: (selectedLocale) => [selectedLocale],
        }),
        skipBuild: options.skipBuild,
        webBaseUrl,
      })

      yield* Effect.forEach(
        results,
        (result) => Console.log(`Public PDF written to ${result.outputPath}`),
        { discard: true }
      )
    })
)

runCli(publicPdfCommand, { version: '0.1.0' })
