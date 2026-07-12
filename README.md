# CV Workspace

This repository is an Nx/Bun workspace for building and operating a static,
content-driven CV site. It separates a reusable content pipeline from the
concrete CV application that consumes it:

- the workspace libraries discover, compose, validate, encrypt, and publish
  content artifacts;
- `apps/cv` owns the CV schema, rendering, routes, i18n, and print layout;
- optional private profiles are delivered from static hosting as encrypted
  browser-opened payloads;
- analytics are derived from Cloudflare request data through a small Worker, so
  the public CV does not need client-side analytics scripts;
- application campaigns can write to a synchronized, event-backed Cloudflare
  D1 registry through a separate authenticated Worker and offline-first client;
- production infrastructure is described with Terraform/Terragrunt for
  Infisical, Cloudflare, and Grafana.

The original deployment keeps authored CV content in a separate private content
repository. Forks can use the checked-in fixture content for development, then
point `CONTENT_ROOT` at their own content repository when they are ready to
publish.

## What This Solves

A normal public CV site is easy to host, but awkward to tailor. You often want a
clean public version, private role-specific versions, downloadable PDFs, and
some visibility into which shared links are being viewed, without moving the CV
behind an application server.

This workspace keeps the deployed site static:

- public pages are built as Astro static output;
- private profile data and private files are encrypted at build time;
- each private link carries a compact bearer token for one encrypted profile;
- Cloudflare logs provide analytics data without adding browser trackers;
- Grafana reads sanitized analytics tables from a Cloudflare Worker connector.

## Architecture

- `apps/cv`: Astro application for the concrete CV experience. It owns the CV
  content contract, schema registry, app-specific composition, React/Astro
  rendering, private unlock UI, public routes, and print/PDF presentation.
- `apps/analytics-connector`: Cloudflare Worker that queries Cloudflare
  Analytics GraphQL, sanitizes the result, decodes private audience ids when
  configured, and exposes Grafana-friendly JSON endpoints.
- `apps/application-registry-api`: authenticated Effect `HttpApi` Worker backed
  by D1. It translates HTTP requests into registry service calls and does not
  own persistence or business rules.
- `libs/application-registry/entity`: canonical TS-first Drizzle tables and
  inferred models, plus select/insert/update Effect codecs derived with
  Drizzle's official Effect integration.
- `libs/application-registry/crud`: database-operation contracts at the package
  root, D1/Drizzle implementations under `/d1`, and reusable Miniflare test
  support.
- `libs/application-registry/service`: database-independent service contracts at
  the package root and registry workflow implementations under `/live`, covering
  replay/conflict handling, explicit lifecycle changes, and pagination.
- `libs/application-registry/fx`: Frankfurter exchange-rate access plus
  isolate-local and D1-backed 24-hour caching.
- `libs/application-registry/api-contract`: Effect `HttpApi`, transport schemas,
  errors, authorization declaration, and OpenAPI document.
- `libs/application-registry/api-client`: typed Effect client and layer derived
  directly from the registry `HttpApi` declaration.
- `libs/content-core`: shared content vocabulary, schema primitives, variables,
  overlays, and file-index types. It does not define the CV app's final content
  schema.
- `libs/content-composer`: generic repository discovery and composition helpers
  for TS/JS/MDX content modules under profile/locale folders.
- `libs/content-build`: build-time artifact generation, public id mangling,
  private runtime inference, static file copying, encrypted private file
  emission, and private link helpers.
- `libs/content-astro`: Astro integration that wires the content pipeline into
  Vite virtual modules and emits generated content files during dev/build.
- `libs/private-content-*`: crypto, token, runtime manifest, config, and browser
  session packages for static private content.
- `libs/analytics-*` and `libs/cloudflare-analytics-client`: sanitized analytics
  data model, Cloudflare client, and Grafana table adapter.
- `libs/ui`, `libs/color-scheme`, `libs/browser-stream-save`, and
  `libs/handlebars-css-template`: small reusable UI/runtime utilities used by
  the app and tools.
- `tools/*`: operator tools for content declaration generation, private link
  minting, PDF export, application-campaign drafting, and querying/updating the
  synchronized application registry.
- `terraform/*`: Terragrunt live stacks and Terraform modules for Infisical
  secret folders, Cloudflare Pages/Worker resources, and Grafana dashboards.

## Workspace Boundary

The key boundary is that most packages are intentionally not CV-schema-aware.
They know how to discover a content repository, load modules, merge profile
overrides, generate static artifacts, encrypt private runtime payloads, and
serve those artifacts to an app. They do not decide what a CV section is, what
fields an experience item has, or how any section should render.

`apps/cv` owns those app-specific decisions through:

- `apps/cv/src/cv-content/contract.ts`: default locale/profile, schema version,
  authoring module, and composition entrypoint;
- `apps/cv/src/cv-content/schema/*`: the concrete CV content schemas;
- `apps/cv/src/cv-content/compose/*`: how discovered sections become CV data;
- `apps/cv/src/components/cv/*`: rendering for the final CV document;
- `apps/cv/src/pages/*`: public and private Astro routes.

If you fork this as a different portfolio or document site, this is the part you
replace first. The content, private-runtime, analytics, and tooling packages can
stay mostly as platform code.

## Local Development

Prerequisites are Bun, Nx through the workspace install, and either a normal
local toolchain or the provided Nix dev shell. The `.envrc` file loads
`.env.local`, disables Astro telemetry, tries to export Infisical secrets when
available, and supplies deterministic local defaults for `CONTENT_ID_SALT` and
`PRIVATE_CONTENT_AUDIENCE_KEY`.

Run against the checked-in fixture content:

```bash
direnv allow
bun install
CONTENT_ROOT="$PWD/fixtures/cv-content-e2e" bunx nx run cv:dev
```

For your own content, point `CONTENT_ROOT` at a repository root that contains
`content.config.ts`:

```bash
CONTENT_ROOT=/path/to/your-content bunx nx run cv:dev
```

Private profile builds and local private link minting also need
`PRIVATE_CONTENT_ROOT_KEY`. Use a 32-byte root key encoded in the format accepted
by `@cv/private-content-crypto`, for example the `base64url:...` form used by
the fixture and Terraform-generated production secret.

Useful commands:

```bash
bunx nx run cv:build
bunx nx run cv:test:e2e
bunx nx run analytics-connector:build
bunx nx run pdf-export:public
bunx nx run private-content-link:link -- \
  --profile frontend \
  --audience acme \
  --locale en \
  --base-url https://cv.example.com
bunx nx run content-types:generate
bunx nx run application-registry:registry -- list
```

See [apps/cv/README.md](apps/cv/README.md) for the app content model, route
shape, private unlock flow, and PDF behavior.

## Deployment Model

The production setup is designed around three managed services:

- Infisical stores build, deploy, analytics, and Grafana secrets under `/cv/*`.
  Terraform creates the folder shape and generated secrets such as
  `CONTENT_ID_SALT`, `PRIVATE_CONTENT_AUDIENCE_KEY`,
  `PRIVATE_CONTENT_ROOT_KEY`, and `GRAFANA_CONNECTOR_TOKEN`.
- Cloudflare hosts the static CV through Pages, the analytics connector Worker,
  and the application registry Worker/D1 database. Terraform creates the
  resources and routes; Wrangler deploys Worker code, bindings, migrations, and
  runtime secrets in CI.
- Grafana reads the Worker through the Infinity datasource. Terraform provisions
  the datasource, folder, and starter dashboard from
  `terraform/grafana/dashboards/cv-analytics.json.tftpl`.

The included GitHub workflows are split by responsibility:

- `CI` runs formatting, linting, typechecking, unit tests, migration drift
  detection, Miniflare integration suites for registry persistence, services,
  and API behavior, Worker builds/e2e tests, and browser e2e tests against
  checked-in fixture content.
- `Deploy CV` fetches Infisical secrets, checks out the private content
  repository, builds the static app, exports public PDFs, publishes release PDF
  assets, and deploys Cloudflare Pages.
- `Deploy Analytics` builds and deploys the Cloudflare Worker when the analytics
  project is affected or the workflow is run manually.
- `Deploy Application Registry` builds the Worker, applies D1 migrations,
  uploads its bearer token, and deploys the authenticated API.

Forks should review `.github/workflows/deploy-cv.yml` before production use. The
content checkout step needs to point at the fork's content repository or another
private source that matches the `apps/cv` content contract.

See [terraform/README.md](terraform/README.md) for the exact bootstrap order,
secret folders, Cloudflare permissions, and Grafana prerequisites.

## Documentation Map

- [apps/cv/README.md](apps/cv/README.md): concrete CV app, content schema,
  routes, private access, and PDF export.
- [apps/analytics-connector/README.md](apps/analytics-connector/README.md):
  Worker configuration and Grafana endpoints.
- [apps/application-registry-api/README.md](apps/application-registry-api/README.md):
  D1 schema, Worker API, local development, and deployment ownership.
- [terraform/README.md](terraform/README.md): Infisical, Cloudflare, and Grafana
  infrastructure.
- [tools/content-types/README.md](tools/content-types/README.md): generate
  portable `virtual:content` declarations for a content repository.
- [tools/private-content-link/README.md](tools/private-content-link/README.md):
  mint private audience/profile links.
- [tools/pdf-export/README.md](tools/pdf-export/README.md): generate public and
  private PDFs with Playwright.
- [tools/application-campaign/README.md](tools/application-campaign/README.md):
  draft application campaign artifacts from a job posting.
- [tools/application-registry/README.md](tools/application-registry/README.md):
  cross-device registry CLI and durable outbox.

Package-level READMEs under `libs/*` describe smaller library boundaries and
public imports.
