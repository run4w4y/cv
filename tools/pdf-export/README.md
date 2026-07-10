# @cv/pdf-export

Playwright-based PDF export tooling for the CV app.

The exporter builds or previews the Astro app, opens the requested public or
private route, waits for print QR assets to be ready, and writes PDF files with
the app's print styles. It does not validate content profiles, locales, audience
ids, or private tokens itself; invalid inputs fail through the rendered app
route or readiness checks.

The programmatic `PdfExporter` service exposes `exportProfile`,
`exportProfiles`, and `exportPublic`. A batch builds once, starts one preview
server, launches one browser, and opens a fresh page for each PDF. Import the
service, `PdfExporterLive`, or the accessor functions from `@cv/pdf-export`.

## Public PDFs

```bash
bunx nx run pdf-export:public
bunx nx run pdf-export:public -- --locale en
bunx nx run pdf-export:public -- --locale en --base-url https://cv.example.com
```

Without `--locale`, the command renders the published public locales listed in
`tools/pdf-export/src/cli/public.ts`. Output goes to:

```text
apps/cv/dist/pdf/cv-<locale>.pdf
```

## Private Profile PDFs

```bash
bunx nx run pdf-export:profile -- \
  --locale en \
  --audience <audience-id> \
  --token <profile-token> \
  --base-url https://cv.example.com
```

Private PDFs are local operator artifacts written to:

```text
apps/cv/dist/private-pdf/cv-<locale>-<audience-id>.pdf
```

Options:

- `--base-url`: deployed CV base URL to encode into print QR codes and PDF link
  annotations. This overrides the base URL baked into an existing build during
  export.
- `--skip-build`: reuse an existing `apps/cv/dist` build.

Environment:

- `CV_WEB_BASE_URL`: default deployed CV base URL when `--base-url` is omitted.
- `CV_CHROME_PATH` or `CHROME_PATH`: optional Chromium executable override for
  Playwright.

The private exporter opens the static private route with the audience id and
token supplied by a previously minted private link. Use
`tools/private-content-link` to mint those values.
