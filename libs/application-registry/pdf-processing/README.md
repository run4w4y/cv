# Application Registry PDF Processing

Environment-independent Effect services and workflow logic for PDF generation.
The NATS JetStream/Playwright worker supplies persistence and browser adapters
without duplicating job validation, layout checks, retry policy, or failure
mapping.

```bash
bunx nx run application-registry-pdf-processing:typecheck
bunx nx run application-registry-pdf-processing:test:unit
bunx nx run application-registry-pdf-processing:build
```
