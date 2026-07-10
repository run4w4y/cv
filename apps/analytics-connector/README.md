# @cv/analytics-connector

Cloudflare Worker that exposes sanitized Cloudflare Analytics data as flat JSON
tables for Grafana Infinity.

The static CV site does not ship analytics scripts. Instead, this Worker queries
Cloudflare's request analytics for the CV hostname, normalizes the result through
`@cv/analytics-core`, adapts it with `@cv/analytics-grafana`, and rejects table
rows that would leak private tokens or raw identifiers.

## Configuration

Required Worker secrets:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`: Cloudflare token with GraphQL Analytics
  access.
- `GRAFANA_CONNECTOR_TOKEN`: bearer token required by `/v1/*` endpoints.

Required Worker vars:

- `CLOUDFLARE_ZONE_ID`
- `CV_WEB_HOST`

Optional Worker secrets and vars:

- `PRIVATE_CONTENT_AUDIENCE_KEY`: decodes compact private audience ids back to
  the human-readable audience labels used when links were minted.
- `CLOUDFLARE_GRAPHQL_ENDPOINT`: override for tests or local proxies.
- `CACHE_TTL_SECONDS`: response cache TTL. Defaults to `600`.
- `ANALYTICS_FALLBACK`: `empty` or `sample` fallback mode when Cloudflare
  analytics are not configured.

The production Wrangler config is generated from the same environment surface
used by CI:

```bash
bun apps/analytics-connector/scripts/write-wrangler-config.ts \
  apps/analytics-connector/wrangler.deploy.jsonc
```

Terraform owns the Worker resource and custom domain or route. Wrangler deploys
the bundled code, non-secret vars, and runtime secrets.

## Local Commands

```bash
bunx nx run analytics-connector:build
bunx nx run analytics-connector:dev
bunx nx run analytics-connector:deploy
bunx nx run analytics-connector:test:unit
```

`deploy` builds the Worker, writes `wrangler.deploy.jsonc`, and runs Wrangler.

## Audience Decoding

Private CV links use paths like:

```text
/en/a/<compact-encrypted-audience-id>/?p=<compact-profile-token>
```

Cloudflare records the path, so the Worker can see the compact audience id
without seeing or needing the private profile token. When
`PRIVATE_CONTENT_AUDIENCE_KEY` is configured, the Worker decodes that path id
before returning rows to Grafana. No audience metadata table is required.

If private audience ids are present and the key is missing, requests that need
decoded audience rows fail rather than returning misleading labels.

## Endpoints

`GET /health` is public and returns a small health payload.

All `/v1/*` endpoints require:

```http
Authorization: Bearer <GRAFANA_CONNECTOR_TOKEN>
```

Table endpoints:

- `GET /v1/summary`
- `GET /v1/audiences`
- `GET /v1/audience-daily`
- `GET /v1/audience-dimensions`
- `GET /v1/paths`

Grafana variable endpoints:

- `GET /v1/variables/companies`
- `GET /v1/variables/locales`
- `GET /v1/variables/stages`

Table endpoints accept `from`, `to`, and `host` query parameters. Grafana uses
the variable endpoints to populate dashboard filters.
