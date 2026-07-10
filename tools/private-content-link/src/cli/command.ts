import type { MintedPrivateAudienceLink } from '@cv/content-build'
import { webBaseUrlSchema } from '@cv/content-core'
import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { mintPrivateContentLink } from '../private-link'
import { writePrivateContentLink } from '../write-link'

const audience = Flag.string('audience').pipe(
  Flag.withAlias('aud'),
  Flag.withDescription('Private audience slug.')
)
const baseUrl = Flag.string('base-url').pipe(
  Flag.withSchema(webBaseUrlSchema),
  Flag.withDescription('Deployed CV base URL.'),
  Flag.optional
)
const locale = Flag.string('locale').pipe(
  Flag.withDescription('Private profile locale.')
)
const out = Flag.string('out').pipe(
  Flag.withDescription('Optional path where the URL is written.'),
  Flag.optional
)
const profile = Flag.string('profile').pipe(
  Flag.withDescription('Private profile slug.')
)

const printLink = (link: MintedPrivateAudienceLink) =>
  Effect.all(
    [
      Console.log(link.url),
      Console.log(`Audience: ${link.audience}`),
      Console.log(`Audience id: ${link.audienceId}`),
      Console.log(`Profile id: ${link.profileId}`),
      Console.log(`Profile: ${link.profile}`),
    ],
    { discard: true }
  )

export const linkCommand = Command.make(
  'private-content-link',
  { audience, baseUrl, locale, out, profile },
  (options) =>
    Effect.gen(function* () {
      const link = yield* mintPrivateContentLink({
        audience: options.audience,
        baseUrl: Option.getOrUndefined(options.baseUrl),
        locale: options.locale,
        profile: options.profile,
      })
      const outputPath = Option.getOrUndefined(options.out)

      if (outputPath) {
        yield* writePrivateContentLink({ link, path: outputPath })
      }

      yield* printLink(link)
    })
)
