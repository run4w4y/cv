# CV Workspace

Nx workspace for a multilingual static CV, Grafana-backed analytics connector,
shared UI, private CV runtime encryption helpers, and export tooling. The
production CV app is static-only and deploys without analytics scripts or
private dashboard routes.

Authored CV content lives in the private `run4w4y/cv-content` repository. This
repository owns the app, parsers, schemas, build pipeline, encryption runtime,
analytics connector, infrastructure, and export tooling.

## Development

Clone both repositories next to each other:

```bash
git clone git@github.com:run4w4y/cv.git
git clone git@github.com:run4w4y/cv-content.git
cd cv
direnv allow
bun install
nx run cv:dev
```

`direnv` sets `CONTENT_ID_SALT` and `PRIVATE_CONTENT_AUDIENCE_KEY` to
deterministic local dummy values unless other values are already present. Set
`CONTENT_ROOT=/path/to/cv-content` in `.env.local` or in your shell before
running the app. The path must point at the content repository root, which must
contain `content.config.ts`. Private builds also need `PRIVATE_CONTENT_ROOT_KEY`
as a 32-byte root key.

`direnv` also attempts to load `/cv/*` Infisical folders for content,
analytics, deploy, and Grafana values.

In dev mode the CV app exposes a local-only private profile index at
`/__dev/profiles`. It lists inferred encrypted profile routes, mints local
audience links when private runtime secrets are present, and shows the matching
`private-content-link:link` command as a CLI fallback. Private profiles are accessed
through the same `/en/a/<audience-id>/?p=<token>` flow as
production, not through public profile preview routes.

Set `PUBLIC_CV_FULL_ACCESS_EMAIL` to change the contact address shown in public
redaction notices. It defaults to `access@run4w4y.dev`.

The workspace is split into:

- `apps/cv`: static Astro CV deployed to Cloudflare Pages.
- `apps/analytics-connector`: Cloudflare Worker that exposes sanitized
  Cloudflare Analytics data as Grafana-friendly JSON tables.
- `libs/content-core`: content schemas, shared constants,
  and redaction descriptor types.
- `libs/content-composer`: content composition from discovered TS/TSX and MDX
  modules into the static CV manifest and MDX component registry.
- `libs/content-build`: build-time content shaping, deterministic public id
  mangling, private runtime input inference, and static file artifact emission.
- `libs/content-astro`: Astro integration and Vite virtual module bridge for
  authored content.
- `libs/private-content-crypto`: runtime AES-GCM, hashing, encoding, and Web Crypto
  helpers for static encrypted private profile payloads.
- `libs/private-content-tokens`: compact private profile capability tokens.
- `libs/analytics-core`: sanitized analytics schemas and aggregations.
- `libs/ui`: shared React UI primitives with Storybook coverage.
- `tools/*`: Nx-routed operator tools for content declarations, private links,
  and PDF export.

## Content Model

The private content repository is intentionally simple:

```text
cv-content/
  content.config.ts
  content/
    variables.ts
    profiles/
      default/
        en/
          about.mdx
          experience/
            index.tsx
            acme.mdx
        ru/
          about.mdx
      frontend/
        _files/
          frontend-only-private.pdf
        en/
          experience/acme.mdx
    files/
      public/...
      private/...
```

`content.config.ts` defines the known locale list, optional `contentDir`
(defaulting to `content`), and profile ids that should remain public. The CV app
owns its default locale/profile. Profile ids themselves are discovered
dynamically from `content/profiles/<profile>/<locale>/`.

Any `.ts`, `.tsx`, `.js`, `.jsx`, or `.mdx` file under a profile/locale folder
is a section. `index.*` is treated as the containing directory section, and
other filenames become section ids. Nested directories become subsections. The
content platform only discovers and merges this section tree; the CV app decides
what section ids such as `experience`, `skills`, or `about` mean.

Structured entries and MDX can import authoring components from
`virtual:content`; `VariableLookup` and `RedactedSection` keep the public
build from exposing redacted details while private profiles reveal them through
encrypted runtime payloads. Project and thesis action links are authored
directly in MDX with
`<Link href="...">Label</Link>`. Education thesis callouts can use `<Thesis>`
with the first markdown heading as the title and nested `<Link>` actions for
files or external URLs.

Profile variants inherit the `default` profile by section path and override it
with profile-local sections. A directory can exist only to group subsections. If
two files resolve to the same section path, for example `about.ts` and
`about/index.mdx`, the build fails.

Shared code is just normal TypeScript imported by authored modules. The content
platform has no special shared merge layer.

Files use a split between global files and profile-local files. Files under
`content/files/public/` are copied as public static files under `/files/`. Files
under `content/files/private/` are shared private files: a single source file is
encrypted separately for every composed profile, including public profiles that
need to render locked private links. Files under
`content/profiles/<profile>/_files/` are private files for that profile only. A
profile-local file with the same relative path overrides the shared private file
for that profile. Output paths keep the same relative filename/path; only the
bytes are encrypted.

Private profile payloads are inferred from composed content profiles/locales.
Public profile ids are deterministic salted hashes in built output; authored
profile slugs and section filenames stay inside the private content/build
environment. Profiles with private files also participate in private profile
inference. Redacted variable values live in the private content repository and
are encrypted into the profile runtime payload.

Private links use an encrypted audience path and a compact bearer capability
token:

```text
https://cv.example.com/en/a/<compact-encrypted-audience-id>/?p=<base64url-v1-profile-token>
```

The version-1 token is `base64url(0x01 || 32-byte profile content key)`. The
browser derives a short selector from that key, loads exactly one encrypted
profile chunk for the current locale, then opens it with the content key. The
audience id stays in the path as a reversible compact encrypted slug for
analytics attribution. Minting another audience URL for an existing profile does
not require a static app rebuild; adding or changing encrypted content still
requires rebuilding the private runtime profile chunks.

## PDF Export

The website has an `Export PDF` button that opens the browser print dialog with
print-specific styling.

To generate static PDFs into `apps/cv/dist/pdf/`:

```bash
nx run pdf-export:public
```

Pass `-- --locale en` to regenerate a single public locale PDF.

Private profile PDFs are generated locally only and are written to
`apps/cv/dist/private-pdf/`:

```bash
nx run pdf-export:profile -- --locale en --audience JLl8... --token AQ...
```

The PDF exporter does not inspect content, validate locales, or mint tokens. It
starts Astro preview, opens the supplied route with Playwright, and lets the app
return 404 or fail readiness if the route/token is invalid.

Published PDF links:

- [English CV PDF](https://github.com/run4w4y/cv/releases/download/cv-pdf-latest/cv-en.pdf)
- [Russian CV PDF](https://github.com/run4w4y/cv/releases/download/cv-pdf-latest/cv-ru.pdf)

## Analytics

Analytics remain derived from Cloudflare's existing request data, so the static
CV does not ship client-side analytics scripts. The dashboard path is:

1. `apps/analytics-connector`: Cloudflare Worker that translates sanitized
   Cloudflare Analytics plus audience metadata into flat Grafana-friendly JSON
   tables.
2. `libs/analytics-grafana`: table/metadata/safety adapter shared by the
   Worker.
3. `terraform/live/prod/grafana`: Terraform-managed Grafana Infinity data
   source, folder, and starter dashboard.

Maintenance commands:

```bash
nx run private-content-link:link -- --profile frontend --audience acme
```

## CI and Deployment

The public repo workflow accepts three deploy sources:

- push to `main`
- manual `workflow_dispatch`
- `repository_dispatch` with type `content-updated` from
  `run4w4y/cv-content`

At runtime the workflow:

1. Fetches `/cv/*` secrets from Infisical through OIDC.
2. Checks out `run4w4y/cv-content` at the requested content ref.
3. Sets `CONTENT_ROOT` to that checkout.
4. Runs checks and builds the static app. The Astro content integration emits
   private runtime assets during the app build. The workflow then exports public
   PDFs, deploys the Worker, and deploys Cloudflare Pages.

Required GitHub repository variables:

- `CV_WEB_BASE_URL`: public site URL, used for print QR codes and PDF links.
- `CLOUDFLARE_PAGES_PROJECT`: Cloudflare Pages project name.
- `INFISICAL_IDENTITY_ID`: Infisical machine identity id for GitHub OIDC.
- `INFISICAL_PROJECT_SLUG`: Infisical project slug.
- `INFISICAL_ENV`: optional, defaults to `prod`.
- `INFISICAL_HOST`: optional, defaults to `https://app.infisical.com`.

Required Infisical values:

- `/cv/content:CONTENT_ID_SALT` for deterministic public id mangling.
  Terraform generates the production value; local dev uses the dummy value from
  `.envrc` unless overridden.
- `/cv/content:CONTENT_REPO_TOKEN`
- `/cv/content:PRIVATE_CONTENT_AUDIENCE_KEY` for reversible encrypted audience ids.
  Terraform generates the production value; local dev uses the dummy value from
  `.envrc` unless overridden. CI also uploads this value as an analytics Worker
  secret so Grafana rows can decode audience labels without metadata.
- `/cv/content:PRIVATE_CONTENT_ROOT_KEY` as the 32-byte root key used to derive
  private profile content keys.
- `/cv/deploy:CLOUDFLARE_ACCOUNT_ID`
- `/cv/deploy:CLOUDFLARE_API_TOKEN`
- `/cv/deploy:CLOUDFLARE_ZONE_ID`
- `/cv/deploy:CV_WEB_HOST`
- `/cv/analytics:CLOUDFLARE_ANALYTICS_API_TOKEN`
- `/cv/analytics:GRAFANA_CONNECTOR_TOKEN`

The content repo needs one GitHub secret:

- `CV_PUBLIC_REPO_DISPATCH_TOKEN`: token allowed to dispatch
  `run4w4y/cv` workflows.

Published release assets:

- `cv-en.pdf`: English PDF export.
- `cv-ru.pdf`: Russian PDF export.

Uploaded workflow artifacts:

- `cv-dist`: static site output without generated PDFs.
