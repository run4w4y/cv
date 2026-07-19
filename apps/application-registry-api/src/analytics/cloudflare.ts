import {
  CvAnalyticsTrafficSource,
  RegistryAnalyticsError,
} from '@cv/application-registry-service'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Effect, Layer } from 'effect'

const make = Effect.gen(function* () {
  const client = yield* CloudflareAnalytics.Service

  return CvAnalyticsTrafficSource.of({
    read: Effect.fn('CloudflareCvAnalyticsTraffic.read')((aliases, range) =>
      client.readAliasedPaths({ aliases, pathLike: '/c/%', range }).pipe(
        Effect.mapError(
          (cause) =>
            new RegistryAnalyticsError({
              cause,
              message: 'CV traffic analytics are currently unavailable.',
            })
        )
      )
    ),
  })
})

export const CloudflareCvAnalyticsTrafficLive = Layer.effect(
  CvAnalyticsTrafficSource,
  make
)
