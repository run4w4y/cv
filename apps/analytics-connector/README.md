# @cv/analytics-connector

Cloudflare Worker that exposes sanitized Cloudflare Analytics data as flat JSON
tables for Grafana Infinity.

Neither the frozen Pages site nor the v2 SSR CV Worker ships analytics scripts.
Instead, this Worker queries Cloudflare's request analytics for the CV hostname,
normalizes the result through `@cv/analytics-core`, adapts it with
`@cv/analytics-grafana`, and rejects table rows that would leak frozen-v1
private query tokens or raw identifiers.

## Configuration

Required Worker secrets:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`: Cloudflare token with GraphQL Analytics
  access.
- `GRAFANA_CONNECTOR_TOKEN`: bearer token required by `/v1/*` endpoints.

Required Worker vars:

- `CLOUDFLARE_ZONE_ID`
- `CV_WEB_HOST`

Optional Worker secrets and vars:

- `PRIVATE_CONTENT_AUDIENCE_KEY`: frozen-v1 compatibility only; decodes compact
  private audience ids already present in historical or still-running Pages
  traffic.
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

Terraform owns the Worker's dedicated `workers.dev` exposure resource and
derived URL. Wrangler owns Worker creation and deploys the bundled code,
observability configuration, non-secret vars, and runtime secrets while
preserving that exposure setting.

## Local Commands

```bash
bunx nx run analytics-connector:build
bunx nx run analytics-connector:dev
bunx nx run analytics-connector:deploy
bunx nx run analytics-connector:test:unit
```

`deploy` builds the Worker, writes `wrangler.deploy.jsonc`, and runs Wrangler.

## Frozen-v1 audience decoding

The detached Pages deployment used private CV paths like:

```text
/en/a/<compact-encrypted-audience-id>/?p=<compact-profile-token>
```

Cloudflare recorded the path, so the connector can still see the compact
audience ID without seeing or needing the private profile query token. When
`PRIVATE_CONTENT_AUDIENCE_KEY` is configured, the connector decodes that path
ID before returning historical rows to Grafana. No audience metadata table is
required.

If private audience ids are present and the key is missing, requests that need
decoded audience rows fail rather than returning misleading labels.

This format is not the v2 publication contract. New CVs use stable shareable
`/c/:token` links backed by the registry, and the analytics connector does not
decode those tokens into v1 audiences or profiles. The old codec and secret
remain solely so freezing Pages and detaching its CI does not invalidate
existing analytics history.

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

Generated tables are cached in `caches.default` under an internal v2 key. The
internal response is explicitly cacheable for `CACHE_TTL_SECONDS`; authenticated
HTTP responses remain `private, no-store`. Invalid cache entries are evicted and
regenerated, and cache writes are best-effort.
