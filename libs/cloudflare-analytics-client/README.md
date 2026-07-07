# CF Analytics Client

Private Effect-based client for fetching Cloudflare GraphQL Analytics and normalizing the response into `@cv/analytics-core` dashboard data.

## Environment

- `CLOUDFLARE_API_TOKEN`: Cloudflare token with GraphQL Analytics access.
- `CLOUDFLARE_ZONE_ID`: Cloudflare zone tag.
- `CV_WEB_HOST`: optional hostname filter, for example `cv.example.com`.
- `CLOUDFLARE_GRAPHQL_ENDPOINT`: optional override for tests or local proxies.

The API token is stored as an Effect `Redacted` value in config and is only unwrapped at the HTTP boundary.

## Flow

1. Parse config with `readCloudflareAnalyticsConfigFromEnv`.
2. Build a bounded `CloudflareAnalyticsRange` from explicit `from`/`to` values or the default last 30 days.
3. Execute the Cloudflare GraphQL request through `Effect.tryPromise`.
4. Prefer `dailyPaths` rows from the GraphQL payload, falling back to `topPaths` only when no daily rows exist.
5. Pass those rows through `sanitizeAnalyticsInput` from `analytics-core`.

The package never returns raw GraphQL rows to the app. The public return shape is sanitized `AnalyticsDashboardData`.

## Relay Decision

Relay is intentionally not used here. The package executes one bounded Cloudflare GraphQL Analytics query, normalizes the response, and returns a sanitized server/client data object. Adding Relay would introduce a React-oriented normalized cache, generated artifacts, and component data-layer conventions without a matching benefit for this small package.

Keep this client framework-neutral: Cloudflare GraphQL request construction, typed Effect errors, and analytics normalization live here; Grafana-specific table shaping stays in `libs/analytics-grafana`.

## Errors

All expected failures are typed with `Data.TaggedError`:

- `CloudflareAnalyticsConfigError`
- `CloudflareAnalyticsRequestError`
- `CloudflareAnalyticsHttpError`
- `CloudflareAnalyticsGraphQLError`
- `CloudflareAnalyticsParseError`
- `CloudflareAnalyticsNormalizeError`

Consumers can stay in Effect with `fetchCloudflareAnalyticsDashboardDataFromEnv` or use the promise wrapper at an HTTP boundary.
