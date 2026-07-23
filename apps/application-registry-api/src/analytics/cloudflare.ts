import {
  CvAnalyticsTrafficSource,
  RegistryAnalyticsError,
} from '@cv/application-registry-service'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Effect, Layer } from 'effect'

const make = Effect.gen(function* () {
  const client = yield* CloudflareAnalytics.Service

  const providerError = (cause: CloudflareAnalytics.Error) =>
    new RegistryAnalyticsError({
      cause,
      message: 'CV traffic analytics are currently unavailable.',
    })

  return CvAnalyticsTrafficSource.of({
    capabilities: Effect.fn('CloudflareCvAnalyticsTraffic.capabilities')(() =>
      client.readLimits().pipe(
        Effect.map(({ retentionMs }) => ({ retentionMs })),
        Effect.mapError(providerError)
      )
    ),
    read: Effect.fn('CloudflareCvAnalyticsTraffic.read')((aliases, range) =>
      client
        .readAliasedPaths({ aliases, range })
        .pipe(Effect.mapError(providerError))
    ),
  })
})

export const CloudflareCvAnalyticsTrafficLive = Layer.effect(
  CvAnalyticsTrafficSource,
  make
)
