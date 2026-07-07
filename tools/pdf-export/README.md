# pdf-export

PDF export tooling for the CV app.

First-class commands:

```bash
nx run pdf-export:public
nx run pdf-export:public -- --locale <locale>
nx run pdf-export:profile -- --locale <locale> --audience <aud1-id> --token <token>
```

Environment variables:

- `CV_CHROME_PATH` or `CHROME_PATH`: optional Chromium executable override for Playwright.

Notes:

- `public` starts Astro preview, opens each published public locale route, waits
  for browser-generated print QR codes, and writes public PDFs under
  `apps/cv/dist/pdf`. Pass `--locale` to render a single locale.
- `profile` requires an existing audience id and capability token.
  It builds the CV app, starts preview, opens the supplied private route, waits
  for private render readiness, and writes one private PDF under
  `apps/cv/dist/private-pdf`.
- `profile --skip-build` reuses an existing build.

The exporter intentionally does not validate locales/audiences or mint tokens.
Invalid input is surfaced by the CV app route or render-readiness checks.
