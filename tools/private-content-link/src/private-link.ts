import {
  type MintedPrivateAudienceLink,
  mintPrivateAudienceLinkFromSecrets,
} from '@cv/content-build'
import { type WebBaseUrl, webBaseUrlFromSelfSchema } from '@cv/content-core'
import {
  type PrivateContentEnv,
  readPrivateAudienceKey,
  readPrivateContentIdSalt,
  readRequiredPrivateContentBuildSecrets,
  withPrivateContentEnv,
} from '@cv/private-content-config'
import { WebCryptoApi } from '@cv/private-content-crypto'
import { Context, Data, Effect, Layer, Schema } from 'effect'

export type PrivateContentLinkRequest = {
  readonly audience: string
  readonly baseUrl?: URL
  readonly env?: PrivateContentEnv
  readonly locale: string
  readonly profile: string
}

export class PrivateContentLinkConfigError extends Data.TaggedError(
  'PrivateContentLinkConfigError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class PrivateContentLinkMintError extends Data.TaggedError(
  'PrivateContentLinkMintError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export type PrivateContentLinkError =
  | PrivateContentLinkConfigError
  | PrivateContentLinkMintError

export type PrivateContentLinkResult = MintedPrivateAudienceLink

export type PrivateContentLinkService = {
  readonly mint: (
    request: PrivateContentLinkRequest
  ) => Effect.Effect<PrivateContentLinkResult, PrivateContentLinkError>
}

export class PrivateContentLink extends Context.Service<
  PrivateContentLink,
  PrivateContentLinkService
>()('@cv/private-content-link/PrivateContentLink') {}

const linkConfig = Effect.all({
  audienceKey: readPrivateAudienceKey,
  contentIdSalt: readPrivateContentIdSalt,
  privateSecrets: readRequiredPrivateContentBuildSecrets,
})

const readLinkConfig = (env?: PrivateContentEnv) =>
  (env ? withPrivateContentEnv(linkConfig, env) : linkConfig).pipe(
    Effect.mapError(
      (cause) =>
        new PrivateContentLinkConfigError({
          cause,
          message: `Could not read private content link configuration: ${cause.message}`,
        })
    )
  )

const mintPrivateContentLinkLive = ({
  audience,
  baseUrl,
  env,
  locale,
  profile,
}: PrivateContentLinkRequest) =>
  Effect.gen(function* () {
    const { audienceKey, contentIdSalt, privateSecrets } =
      yield* readLinkConfig(env)

    const normalizedBaseUrl: WebBaseUrl | undefined = baseUrl
      ? yield* Schema.decodeUnknownEffect(webBaseUrlFromSelfSchema)(
          baseUrl
        ).pipe(
          Effect.mapError(
            (cause) =>
              new PrivateContentLinkConfigError({
                cause,
                message: 'The deployed CV base URL is invalid.',
              })
          )
        )
      : undefined

    return yield* mintPrivateAudienceLinkFromSecrets({
      audience,
      audienceKey,
      baseUrl: normalizedBaseUrl,
      contentIdSalt,
      locale,
      profile,
      secrets: privateSecrets,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new PrivateContentLinkMintError({
            cause,
            message: `Could not mint private content link: ${cause.message}`,
          })
      )
    )
  })

export const PrivateContentLinkLive = Layer.effect(
  PrivateContentLink,
  WebCryptoApi.pipe(
    Effect.map(
      (webCrypto): PrivateContentLinkService => ({
        mint: (request) =>
          mintPrivateContentLinkLive(request).pipe(
            Effect.provideService(WebCryptoApi, webCrypto)
          ),
      })
    )
  )
)

export const mintPrivateContentLink = (request: PrivateContentLinkRequest) =>
  PrivateContentLink.pipe(Effect.flatMap((service) => service.mint(request)))
