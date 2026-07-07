# @cv/analytics-grafana

Grafana adapter for sanitized analytics dashboard data.

This package turns `@cv/analytics-core` dashboard records into flat table rows
that are convenient for Grafana data sources and dashboard variables. It also
checks generated rows for private tokens or raw identifiers before they leave
the analytics boundary.
