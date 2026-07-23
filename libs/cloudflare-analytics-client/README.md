# @cv/cloudflare-analytics-client

Layered Effect client for Cloudflare GraphQL Analytics.

The package owns Cloudflare request construction, provider-limit discovery,
range chunking, provider error classification, strict response decoding, and
typed-row aggregation. It reads the active dataset's retention, maximum query
duration, and page-size limits from Cloudflare and caches successful discovery
for one hour. Every successful response is decoded once with Effect Schema;
malformed rows fail instead of being converted into zero traffic. A full result
page also fails explicitly because Cloudflare may have truncated it.

The application service owns user-facing range validation and passes canonical
UTC ranges to this adapter. The client aggregates exact CV paths behind
caller-owned opaque aliases and never returns raw GraphQL rows or aliased paths
to application code.

## Services

The package exports one `CloudflareAnalytics` module namespace:

- `Configuration` is the required configuration service.
- `Service` exposes `readLimits` and `readAliasedPaths`.
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
