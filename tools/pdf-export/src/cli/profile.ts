import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { exportProfilePdf } from '../exporter'
import { resolveWebBaseUrl, webBaseUrlFlag } from './config'
import { runCli } from './runtime'

const audience = Flag.string('audience').pipe(
  Flag.withDescription(
    'Private audience id/path segment from the capability token.'
  )
)
const token = Flag.string('token').pipe(
  Flag.withDescription('Private profile capability token.')
)
const locale = Flag.string('locale').pipe(
  Flag.withDescription('Private profile locale.')
)
const skipBuild = Flag.boolean('skip-build').pipe(
  Flag.withDescription('Reuse an existing CV build instead of rebuilding.')
)
const outputDir = Flag.string('output-dir').pipe(
  Flag.withDescription('Directory where the private PDF is written.'),
  Flag.optional
)
const outputFileName = Flag.string('output-file-name').pipe(
  Flag.withDescription('Exact output PDF file name.'),
  Flag.optional
)

export const profilePdfCommand = Command.make(
  'profile',
  {
    audience,
    baseUrl: webBaseUrlFlag,
    locale,
    outputDir,
    outputFileName,
    skipBuild,
    token,
  },
  (options) =>
    Effect.gen(function* () {
      const webBaseUrl = yield* resolveWebBaseUrl(options.baseUrl)
      const result = yield* exportProfilePdf({
        audienceId: options.audience,
        locale: options.locale,
        outputDir: Option.getOrUndefined(options.outputDir),
        outputFileName: Option.getOrUndefined(options.outputFileName),
        skipBuild: options.skipBuild,
        token: options.token,
        webBaseUrl,
      })

      yield* Console.log(`Private profile PDF written to ${result.outputPath}`)
    })
)

runCli(profilePdfCommand, { version: '0.1.0' })
