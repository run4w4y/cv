import { Context, Effect, Layer, Option } from 'effect'

export type ContentAccessTokenService = {
  readonly read: Effect.Effect<Option.Option<string>>
}

export class ContentAccessToken extends Context.Service<
  ContentAccessToken,
  ContentAccessTokenService
>()('@cv/private-content-session/ContentAccessToken') {}

export const makeContentAccessTokenLayer = (token: string | null) =>
  Layer.succeed(ContentAccessToken, {
    read: Effect.succeed(Option.fromNullishOr(token)),
  })
