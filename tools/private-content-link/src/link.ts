import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { mintPrivateAudienceLinkFromSecrets } from '@cv/content-build'
import {
  readPrivateAudienceKey,
  readPrivateContentIdSalt,
  readRequiredPrivateContentBuildSecrets,
  withPrivateContentEnv,
} from '@cv/private-content-config'
import { WebCryptoApiLayer } from '@cv/private-content-crypto'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Data, Effect, Layer } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

type LinkOptions = {
  audience?: string
  baseUrl: string
  locale?: string
  outPath?: string
  profile?: string
}

class PrivateContentLinkError extends Data.TaggedError(
  'PrivateContentLinkError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new PrivateContentLinkError({
      cause,
      message: `${message}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    })
  }

  static fail(message: string) {
    return Effect.fail(new PrivateContentLinkError({ message }))
  }
}

const rootDir = resolve(import.meta.dir, '../../..')

const parsed = parseArgs({
  options: {
    'base-url': {
      default: '',
      type: 'string',
    },
    aud: {
      type: 'string',
    },
    audience: {
      type: 'string',
    },
    locale: {
      type: 'string',
    },
    out: {
      type: 'string',
    },
    profile: {
      type: 'string',
    },
  },
  strict: true,
})

const options = {
  audience: parsed.values.audience ?? parsed.values.aud,
  baseUrl: parsed.values['base-url']?.replace(/\/+$/u, '') ?? '',
  locale: parsed.values.locale,
  outPath: parsed.values.out,
  profile: parsed.values.profile,
} satisfies LinkOptions

const fail = PrivateContentLinkError.fail

const resolveProjectPath = (rawPath: string) =>
  Path.pipe(
    Effect.map((path) =>
      rawPath.startsWith('/') ? rawPath : path.resolve(rootDir, rawPath)
    )
  )

const writeUrlIfRequested = (outPath: string | undefined, url: string) =>
  outPath
    ? Effect.gen(function* () {
        const path = yield* resolveProjectPath(outPath)
        const fileSystem = yield* FileSystem
        const platformPath = yield* Path

        yield* fileSystem.makeDirectory(platformPath.dirname(path), {
          recursive: true,
        })
        yield* fileSystem.writeFileString(path, `${url}\n`)
      })
    : Effect.void

const readLinkConfig = Effect.all({
  audienceKey: readPrivateAudienceKey,
  contentIdSalt: readPrivateContentIdSalt,
  privateSecrets: readRequiredPrivateContentBuildSecrets,
}).pipe(
  withPrivateContentEnv,
  Effect.mapError((cause) =>
    PrivateContentLinkError.fromCause({
      cause,
      message: 'Could not read private content link config',
    })
  )
)

const program = Effect.gen(function* () {
  if (!options.profile) {
    return yield* fail('Missing --profile')
  }

  if (!options.audience) {
    return yield* fail('Missing --audience or --aud')
  }

  if (!options.locale) {
    return yield* fail('Missing --locale')
  }

  const { audienceKey, contentIdSalt, privateSecrets } = yield* readLinkConfig
  const link = yield* mintPrivateAudienceLinkFromSecrets({
    audience: options.audience,
    audienceKey,
    baseUrl: options.baseUrl,
    contentIdSalt,
    locale: options.locale,
    profile: options.profile,
    secrets: privateSecrets,
  }).pipe(
    Effect.mapError((cause) =>
      PrivateContentLinkError.fromCause({
        cause,
        message: 'Could not mint private content link',
      })
    )
  )

  yield* writeUrlIfRequested(options.outPath, link.url)
  yield* Console.log(link.url)
  yield* Console.log(`Audience: ${link.audience}`)
  yield* Console.log(`Audience id: ${link.audienceId}`)
  yield* Console.log(`Profile id: ${link.profileId}`)
  yield* Console.log(`Profile: ${link.profile}`)
})

program.pipe(
  Effect.catch((error) =>
    Console.error(error instanceof Error ? error.message : String(error)).pipe(
      Effect.andThen(
        Effect.sync(() => {
          process.exitCode = 1
        })
      )
    )
  ),
  Effect.provide(Layer.merge(BunServices.layer, WebCryptoApiLayer)),
  BunRuntime.runMain
)
