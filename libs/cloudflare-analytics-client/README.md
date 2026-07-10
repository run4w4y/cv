# @cv/cloudflare-analytics-client

Effect-based client for Cloudflare GraphQL Analytics.

The client executes one bounded Cloudflare Analytics query, normalizes the
response, and returns sanitized `@cv/analytics-core` dashboard data. It never
returns raw GraphQL rows to application code.

## Environment

- `CLOUDFLARE_API_TOKEN`: Cloudflare token with GraphQL Analytics access.
- `CLOUDFLARE_ZONE_ID`: Cloudflare zone tag.
- `CV_WEB_HOST`: optional hostname filter, for example `cv.example.com`.
- `CLOUDFLARE_GRAPHQL_ENDPOINT`: optional override for tests or local proxies.

The API token is stored as an Effect `Redacted` value and only unwrapped at the
HTTP boundary.

## Flow

1. Parse config with `readCloudflareAnalyticsConfigFromEnv`.
2. Build a bounded `CloudflareAnalyticsRange` from explicit `from`/`to` values
   or the default last 30 days.
3. Execute the Cloudflare GraphQL request.
4. Prefer daily path rows, falling back to top paths when no daily rows exist.
5. Pass rows through `sanitizeAnalyticsInput`.

## Boundary

Keep this package framework-neutral. Cloudflare request construction, typed
Effect errors, and analytics normalization live here. Grafana-specific table
shaping lives in `@cv/analytics-grafana`.

## Verification

```bash
bunx nx run cloudflare-analytics-client:typecheck
bunx nx run cloudflare-analytics-client:test:unit
```
