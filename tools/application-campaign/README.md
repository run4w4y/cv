# @cv/application-campaign

Local operator tool for turning a job posting URL into an application campaign
draft.

The tool fetches a job post, composes available CV content profiles through the
same content pipeline as the CV app, asks the Codex SDK-backed advisor to first
shortlist the relevant profiles from compact summaries, then sends only those
full English profile markdown contexts for the final structured recommendation.
It writes campaign artifacts under `.cv-work/applications/` by default and can
also mint a private CV link and export the matching PDF.

When a fixed profile is supplied, or only one profile remains after exclusions,
the shortlist turn is skipped. Multi-target runs mint links concurrently and
send all eligible PDF requests through one build, preview server, and browser
session.

## Usage

Draft campaign files only:

```bash
bunx nx run application-campaign:prepare -- \
  --url "https://example.com/jobs/backend-engineer" \
  --locale en \
  --no-generate
```

Draft files, mint a private link, and export a private PDF:

```bash
bunx nx run application-campaign:prepare -- \
  --url "https://example.com/jobs/backend-engineer" \
  --locale en \
  --audience example-backend \
  --profile go-backend \
  --base-url https://cv.example.com
```

Prepare a small batch:

```bash
bunx nx run application-campaign:prepare -- \
  --url "https://example.com/jobs/backend-engineer" \
  --url "https://example.com/jobs/platform-engineer" \
  --url-file ./job-urls.txt
```

## Outputs

Each campaign directory contains:

- `job.md`
- `recommendation.json`
- `recommendation.md`
- `cover-letter.md`, when `--materials all`
- `email.md`, when `--materials all`
- `application.json`
- `link.txt`, when a private link is generated
- `pdf-path.txt`, when a private PDF is exported

Every run writes `run.json` in the run output root. A run and each target report
one of `succeeded`, `partial`, or `failed`. Missing optional generation config is
a warning; an actual link, PDF, target, or artifact failure produces a partial
or failed result and a nonzero CLI exit code.

Generated PDFs default to `.cv-work/application-pdfs/`.

## Options

- `--url <url>`: job posting URL. Can be passed multiple times.
- `--url-file <path>`: newline- or comma-separated job posting URL list.
- `--content-root <path>`: content repository root. Overrides
  `APPLICATION_CAMPAIGN_CONTENT_ROOT`.
- `--profile <slug>`: fixed private CV profile. If omitted, the AI recommends
  the best profile from the composed CV content.
- `--exclude-profiles <slugs>`: comma-separated profile slugs excluded from AI
  selection. Defaults to `default`; pass an empty value to include every
  profile.
- `--audience <slug>`: fixed private audience slug. If omitted, the AI suggests
  a company-based slug and the tool normalizes it.
- `--out <path>`: exact campaign artifact output directory for one URL. With
  multiple URLs this becomes the batch output root.
- `--out-root <path>`: directory where default campaign folders are created.
- `--pdf-dir <path>`: directory where generated private PDFs are written.
- `--codex-bin <path>`: Codex executable override passed to the Codex SDK.
- `--model <name>`: Codex model override.
- `--materials <all|none>`: generate or skip cover letter and email drafts.
- `--concurrency <count>`: number of job URLs to process concurrently.
- `--generate` / `--no-generate`: mint a private CV link and export the
  matching PDF. Generation is enabled by default.
- `--skip-pdf`: mint the private link but skip PDF export.
- `--skip-build`: reuse the existing CV build for private PDF export.

## Environment

- `APPLICATION_CAMPAIGN_BASE_URL`
- `APPLICATION_CAMPAIGN_CODEX_BIN`
- `APPLICATION_CAMPAIGN_CODEX_MODEL`
- `APPLICATION_CAMPAIGN_CONCURRENCY`
- `APPLICATION_CAMPAIGN_CONTENT_ROOT`
- `APPLICATION_CAMPAIGN_EXCLUDED_PROFILES`
- `APPLICATION_CAMPAIGN_LOCALE`
- `APPLICATION_CAMPAIGN_MATERIALS`
- `APPLICATION_CAMPAIGN_OUT_DIR`
- `APPLICATION_CAMPAIGN_PDF_DIR`
- `APPLICATION_CAMPAIGN_URLS`
- `CONTENT_ROOT`
- `CV_WEB_BASE_URL`
- `PUBLIC_CV_WEB_BASE_URL`
- `CV_WEB_HOST`

`APPLICATION_CAMPAIGN_CONTENT_ROOT` takes precedence over `CONTENT_ROOT`. If no
content root is configured, the tool falls back to `../cv-content`.

Base URL precedence is `--base-url`, `APPLICATION_CAMPAIGN_BASE_URL`,
`CV_WEB_BASE_URL`, `PUBLIC_CV_WEB_BASE_URL`, then `https://${CV_WEB_HOST}`. If
generation is enabled but no base URL can be resolved, the run logs a warning,
skips private link/PDF generation, and still writes the draft artifacts.

## Programmatic API

The package exports the campaign workflow, its config resolver, the advisor
service, the Codex implementation layer, and the platform runtime layer:

```ts
import {
  ApplicationCampaignRuntimeLayer,
  makeCodexApplicationAdvisorLayer,
  prepareCampaign,
  resolvePrepareCampaignOptions,
} from '@cv/application-campaign'
import { Effect } from 'effect'

const program = resolvePrepareCampaignOptions({
  urls: [new URL('https://example.com/jobs/backend-engineer')],
}).pipe(
  Effect.flatMap(({ advisor, campaign }) =>
    prepareCampaign(campaign).pipe(
      Effect.provide(makeCodexApplicationAdvisorLayer(advisor))
    )
  ),
  Effect.provide(ApplicationCampaignRuntimeLayer)
)
```

Alternative AI implementations provide `ApplicationAdvisor`; campaign code
does not receive Codex binary, model, reasoning, or working-directory settings.
