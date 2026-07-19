# @cv/cloudflare-analytics-client

Layered Effect client for Cloudflare GraphQL Analytics.

The package owns Cloudflare request construction, bounded range handling,
provider error classification, and response normalization. It returns sanitized
dashboard data or aggregates exact paths behind caller-owned opaque aliases; it
never returns raw GraphQL rows or aliased paths to application code.

## Services

The package exports one `CloudflareAnalytics` module namespace:

- `Configuration` is the required configuration service.
- `Service` exposes `readDashboard` and `readAliasedPaths`.
- `layer` builds the client from `Configuration` and Effect's `HttpClient`.

Applications own configuration sources and runtime wiring. Environment variable
names, `ConfigProvider` construction, and runtime execution do not belong in
this package.

```ts
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Effect, Layer, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

const ConfigurationLive = Layer.succeed(
  CloudflareAnalytics.Configuration,
  CloudflareAnalytics.Configuration.of({
    apiToken: Redacted.make('secret-token'),
    endpoint: new URL(CloudflareAnalytics.defaultEndpoint),
    host: 'cv.example.com',
    zoneId: 'zone-id',
  })
)

const ClientLive = CloudflareAnalytics.layer.pipe(
  Layer.provide(Layer.merge(ConfigurationLive, FetchHttpClient.layer))
)

const data = CloudflareAnalytics.Service.use((client) =>
  client.readAliasedPaths({
    aliases: [{ key: 'publication-1', path: '/c/opaque-token' }],
    pathLike: '/c/%',
    range: {
      from: '2026-07-18T00:00:00.000Z',
      to: '2026-07-19T00:00:00.000Z',
    },
  })
).pipe(Effect.provide(ClientLive))
```

The token remains `Redacted` until the HTTP request is constructed.

## Verification

```bash
bunx nx run cloudflare-analytics-client:typecheck
bunx nx run cloudflare-analytics-client:test:unit
```
