# Analytics Connector

Cloudflare Worker connector that adapts sanitized Cloudflare Analytics data into
flat JSON tables for Grafana Infinity.

## Required Secrets

Set these as Worker secrets:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `PRIVATE_CONTENT_AUDIENCE_KEY`
- `GRAFANA_CONNECTOR_TOKEN`

Required Worker vars:

- `CLOUDFLARE_ZONE_ID`
- `CV_WEB_HOST`

Optional Worker vars:

- `CLOUDFLARE_GRAPHQL_ENDPOINT`: override for tests and local proxies.
- `CACHE_TTL_SECONDS`: connector response cache TTL. Defaults to `600`.

## Audience Decoding

Private content links use paths like:

```text
/en/a/<compact-encrypted-audience-id>/?p=<compact-token>
```

Cloudflare records the path, so the connector receives the compact encrypted
audience id without needing the private token. `PRIVATE_CONTENT_AUDIENCE_KEY`
lets the connector decode that id back into the original audience label before
rows are returned to Grafana. No audience metadata JSON or lookup table is
required.

Local Worker deploys use the same generated config path as CI:

```sh
nx run analytics-connector:build
nx run analytics-connector:deploy
```

The generated production Wrangler config sets `workers_dev` to `false`.
Terraform owns the Worker custom domain or route; Wrangler only deploys code,
vars, and secrets.

## Endpoints

All `/v1/*` endpoints require:

```http
Authorization: Bearer <GRAFANA_CONNECTOR_TOKEN>
```

- `GET /health`
- `GET /v1/summary`
- `GET /v1/audiences`
- `GET /v1/audience-daily`
- `GET /v1/audience-dimensions`
- `GET /v1/paths`
- `GET /v1/variables/stages`
- `GET /v1/variables/locales`
- `GET /v1/variables/companies`

All table endpoints accept `from`, `to`, and `host` query parameters.
