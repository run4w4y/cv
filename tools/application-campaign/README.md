# @cv/application-campaign

Local operator tool for turning a job posting URL into an application campaign
draft.

The tool fetches a job post and opens an injectable profile source. The
repository CLI composition reads the content repository directly through the
generic source-repository API: it discovers authored modules from
`content.config.ts` and supplies raw TS/MDX base and profile layers with their
paths and provenance. It does not import the CV application, its schema, its
content contract, or a generated interchange artifact.

The Codex SDK-backed advisor first performs one structured job-analysis pass
over bounded profile-layer summaries. That pass always runs, including
fixed-profile jobs, so plugins can extract additional operational data. The
final pass receives the selected profiles' inherited base and targeted source
layers, plus shared authored support modules, and produces the recommendation
and optional application materials.

It writes campaign artifacts under `.cv-work/applications/` by default and can
also mint a private CV link and export the matching PDF. The one tool project
contains both the generic campaign engine and its private repository CLI
composition. Only `src/cli/composition` and `src/cli/plugins` know about the
local content-repository loader and application-registry package. The reusable
workflow consumes generic authored source layers and does not inspect a final
CV document shape.

Interactive runs print the resolved plan and maintain a live step counter with
the currently active stages. CI and redirected runs automatically use stable,
append-only output. Pass `--output pretty` or `--output plain` to override the
automatic selection.

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
- `artifact-manifest.json`, listing every campaign-owned file

Every run writes `run.json` in the run output root. A run and each target report
one of `succeeded`, `partial`, or `failed`. Missing optional generation config is
a warning; an actual link, PDF, target, or artifact failure produces a partial
or failed result and a nonzero CLI exit code.

Generated PDFs default to `.cv-work/application-pdfs/`.

Artifact directories are prepared in a sibling staging directory and promoted
only after every new file is ready. Reruns remove files owned by the previous
manifest (including stale material, link, and PDF references) while carrying
unrelated operator files such as notes forward. Cover-letter and email subjects
remain available in `recommendation.json` and are included in the standalone
Markdown files.

## Plugins and AI extensions

`CampaignPlugin` contributes executable run- or target-scoped workflow steps.
Steps declare dependencies and one of `warn`, `fail-target`, or `fail-run`.
The graph compiler rejects duplicate IDs, missing dependencies, and cycles;
the same graph drives scheduling and progress events. Step outputs are stored
in an immutable typed context, so plugins can populate prompt additions or
consume prior results without lifecycle-hook argument types.

A plugin extends the shared first AI pass by publishing a named instruction and
Effect schema from one of its steps and registering the typed result key. The
core analysis step reads those contributions from the workflow context, builds
one combined response schema, and decodes the result once.

The CLI-local application-registry plugin uses one contribution to request
submission instructions, orthogonal opportunity details, and structured
compensation in each posting's original currency and integer minor units. After
artifacts commit, it sends one idempotent capture through the registry client.
The client writes to its durable local outbox before attempting the network
request, so an unavailable Worker queues the capture for later replay.

## Options

- `--url <url>`: job posting URL. Can be passed multiple times.
- `--url-file <path>`: newline- or comma-separated job posting URL list.
- `--content-root <path>`: content repository root. Overrides
  `APPLICATION_CAMPAIGN_CONTENT_ROOT`.
- `--profile <slug>`: fixed private CV profile. If omitted, the AI recommends
  the best profile from the authored source context.
- `--exclude-profiles <slugs>`: comma-separated profile slugs excluded from AI
  selection. Defaults to the repository's configured default profile; pass an
  empty value to include every profile.
- `--audience <slug>`: fixed private audience slug. If omitted, the AI suggests
  a company-based slug and the tool normalizes it.
- `--out <path>`: exact campaign artifact output directory for one URL. With
  multiple URLs this becomes the batch output root.
- `--out-root <path>`: directory where default campaign folders are created.
- `--output <auto|pretty|plain>`: terminal presentation mode. Defaults to
  `auto`; explicit Effect `--log-level` diagnostics use plain output.
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
- `REGISTRY_API_URL`, optional; enables registry capture when paired with the
  token
- `REGISTRY_API_TOKEN`, optional; must be configured together with the URL
- `REGISTRY_DEVICE_ID`, optional device label stored on registry events
- `REGISTRY_OUTBOX_DIR`, optional durable outbox location

`APPLICATION_CAMPAIGN_CONTENT_ROOT` takes precedence over `CONTENT_ROOT`. If no
content root is configured, the tool falls back to `../cv-content`.

Base URL precedence is `--base-url`, `APPLICATION_CAMPAIGN_BASE_URL`,
`CV_WEB_BASE_URL`, `PUBLIC_CV_WEB_BASE_URL`, then `https://${CV_WEB_HOST}`. If
generation is enabled but no base URL can be resolved, the run logs a warning,
skips private link/PDF generation, and still writes the draft artifacts.

The operator process intentionally uses the configured production environment:
it needs real content, tokens, links, and PDF settings. The nested Codex process
does not inherit that environment. It receives only the small runtime allowlist
needed to start Codex, runs in a fresh empty temporary directory, and has shell,
network, and web-search access disabled. Production credentials remain available
to the deterministic campaign workflow without being exposed to the AI process.

## Programmatic API

The package exports the campaign workflow, its config resolver, the advisor
service, the Codex implementation layer, and the platform runtime layer:

```ts
import {
  makeApplicationCampaignRuntimeLayer,
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
  Effect.provide(makeApplicationCampaignRuntimeLayer(myProfileSource))
)
```

Alternative AI implementations provide `ApplicationAdvisor`; campaign code
does not receive Codex binary, model, or reasoning settings.
Programmatic callers may also provide `CampaignReporter` to consume typed
workflow progress events; without an override, reporting is silent.

Programmatic callers provide `CampaignProfileSource`. The built-in repository
implementation returns schema-independent authored source layers. Alternative
implementations may provide the same generic layer envelope without depending
on the CV application or materializing a final document contract.

Plugins are composed explicitly:

```ts
import {
  makeCampaignPluginsLayer,
  prepareCampaign,
} from '@cv/application-campaign'
import { Effect } from 'effect'

const plugin = {
  id: 'example',
  steps: [{
    id: 'example.after-artifacts',
    label: 'Record external metadata',
    scope: 'target',
    failurePolicy: 'warn',
    dependsOn: ['write-artifacts'],
    execute: ({ outputs }) => record(outputs).pipe(Effect.as([])),
  }],
}

const program = prepareCampaign(campaign).pipe(
  Effect.provide(makeCampaignPluginsLayer([plugin]))
)
```
