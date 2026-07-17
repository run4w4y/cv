# Application registry management

React Router application for inspecting and filtering the application registry.
The table is authored in this app with TanStack Table; reusable management
primitives live in `@cv/internal-ui`, while `@cv/drizzle-query-ui` renders filter
controls directly from the registry query definition's field metadata.

Registry timestamp fields publish date and range descriptors through the query
definition. The app supplies their management labels and defaults them to
date-time comparisons, so calendar controls are used without app-owned value
conversion.

## Development

Start the API and UI from the repository shell:

```bash
bunx nx run application-registry-api:dev
bunx nx run application-registry-management:dev
```

The Vite development server proxies `/api/registry` to `REGISTRY_API_URL` and
adds `REGISTRY_API_TOKEN` server-side. The token is never included in the
browser bundle. A production host must provide the same authenticated reverse
proxy path, or rewrite it to an equivalent same-origin backend-for-frontend.

Useful checks:

```bash
bunx nx run application-registry-management:typecheck
bunx nx run application-registry-management:test:unit
bunx nx run application-registry-management:build
```
