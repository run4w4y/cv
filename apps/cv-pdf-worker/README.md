# CV PDF Worker

Private Cloudflare Queue consumer for CV PDF generation. The application
registry API creates a pending artifact and transactional outbox record in D1,
then emits a schema-versioned `PdfGenerationRequested` command. This Worker
validates the enabled publication and pinned page revision, renders its exact
public URL with Browser Rendering, stores the content-addressed PDF in R2, and
updates D1. That same stable public URL is embedded in the PDF's QR code. The
page is technically reachable while Browser Rendering runs, but management
only exposes it as shareable once the matching PDF artifact is ready. A
permanent failure disables only that still-current publication.

Queue delivery is at least once, so every persistence operation is idempotent.
Permanent layout/publication failures are recorded and acknowledged; transient
Browser, D1, and R2 failures are retried and eventually handled by the DLQ.

The default fetch export always returns 404. Production disables `workers.dev`
and preview URLs; the Queue consumer is the only application surface.

```bash
bunx nx run cv-pdf-worker:typecheck
bunx nx run cv-pdf-worker:test:unit
bunx nx run cv-pdf-worker:build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config apps/cv-pdf-worker/wrangler.jsonc
```
