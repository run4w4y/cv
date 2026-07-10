import { Console, Effect } from 'effect'
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

export const profilePdfCommand = Command.make(
  'profile',
  { audience, baseUrl: webBaseUrlFlag, locale, skipBuild, token },
  (options) =>
    Effect.gen(function* () {
      const webBaseUrl = yield* resolveWebBaseUrl(options.baseUrl)
      const result = yield* exportProfilePdf({
        audienceId: options.audience,
        locale: options.locale,
        skipBuild: options.skipBuild,
        token: options.token,
        webBaseUrl,
      })

      yield* Console.log(`Private profile PDF written to ${result.outputPath}`)
    })
)

runCli(profilePdfCommand, { version: '0.1.0' })
