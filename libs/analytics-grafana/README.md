# @cv/analytics-grafana

Grafana adapter for sanitized analytics dashboard data.

This package turns `@cv/analytics-core` dashboard records into flat table rows
that are convenient for the Grafana Infinity datasource and dashboard
variables. It also checks generated rows for private tokens or raw identifiers
before they leave the analytics boundary.

## Use For

- `buildGrafanaAnalyticsTables(data)`: build summary, audience, daily,
  dimension, and path tables.
- `assertGrafanaRowsSafe(rows)`: fail if rows contain values that should not be
  exposed to Grafana.

The Cloudflare Worker in `apps/analytics-connector` is the primary consumer.

## Verification

```bash
bunx nx run analytics-grafana:typecheck
bunx nx run analytics-grafana:test:unit
```
