import { ContentAccessToken } from '@cv/private-content-session'
import { Effect, Layer, Option, Schema } from 'effect'

const privateCvTokenParam = 'p'

const tokenFromParams = (params: URLSearchParams) =>
  Schema.decodeUnknownOption(Schema.NonEmptyString)(
    params.get(privateCvTokenParam)?.trim()
  )

export const CvBrowserAccessTokenLayer = Layer.succeed(ContentAccessToken, {
  read: Effect.sync(() => {
    if (typeof window === 'undefined') {
      return Option.none()
    }

    const queryToken = tokenFromParams(
      new URLSearchParams(window.location.search)
    )

    return Option.isSome(queryToken)
      ? queryToken
      : tokenFromParams(
          new URLSearchParams(window.location.hash.replace(/^#/u, ''))
        )
  }),
})
