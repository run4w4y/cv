# @cv/analytics-core

Privacy boundary and shared data model for request-derived CV analytics.

This package accepts unknown raw analytics input, extracts only the fields the
dashboard needs, normalizes paths, aggregates totals, and returns a sanitized
`AnalyticsDashboardData` payload. Callers should treat that payload as the only
analytics shape safe to persist or render.

## Data Model

Dashboard data uses schema `analytics.dashboard.v1`. The top-level payload
contains:

- `paths`: sanitized path records with page views, visits, visitors, series
  points, path kind, optional locale/audience id, and aggregate dimensions.
- `audiences`: summaries derived from private audience paths such as
  `/en/a/<audience-id>/`.
- `range`: date span represented by the input rows.
- `summary`: public, audience, active-audience, and zero-visit totals.

## Sanitizer Boundary

`sanitizeAnalyticsInput` recursively finds rows that expose a known path
dimension, reads common Cloudflare-style metrics and dimensions, normalizes
paths, aggregates totals, sorts output deterministically, and drops unsafe
dimension values.

The sanitizer is intentionally lossy. It ignores anything not needed by the
dashboard.

## Privacy Guarantees

The public dashboard format must not contain:

- private content token query parameters such as `?p=...`;
- raw email addresses;
- raw IPv4 addresses;
- raw user-agent strings or other unaggregated request metadata.

`assertAnalyticsDashboardData` can be used before writing or returning a
payload.

## Verification

```bash
bunx nx run analytics-core:typecheck
bunx nx run analytics-core:test:unit
```
