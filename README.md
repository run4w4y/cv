# CV workspace

Personal application-registry and tailored-CV system deployed on Cloudflare.
The management app prepares one reviewed CV per application from a versioned
facts release and an immutable job-posting snapshot. The public app renders an
approved document at a stable, revocable `/c/:token` URL and preserves the PDF
generated from that exact URL.

The former static/encrypted profile implementation is frozen in its existing
Cloudflare Pages deployment. It is no longer built or deployed by this
repository. The `cv-public` Worker overlays only `/c/*`, so legacy Pages routes
continue to run unchanged.

## Runtime surfaces

- `apps/application-registry-api` is the Cloudflare Worker composition root. It
  owns the authenticated registry API, management SPA/BFF, Login with ChatGPT
  proxy, D1 binding, private R2 binding, and PDF Workflow/Browser Rendering
  binding.
- `apps/application-registry` is the browser management application. It owns
  the schema-aware drafting/editing experience while treating the imported
  Effect schema generically.
- `apps/cv` is the Astro SSR Worker. It accepts only `/c/:token`, resolves an
  enabled publication through a named Worker service binding, validates the
  code-owned document contract, and renders the page.
- `apps/analytics-connector` remains the analytics Worker for the frozen/public
  surfaces.

## Important boundaries

- `@cv/contracts` is the single package containing the code-owned document,
  facts, and opaque-delivery contracts. The registry backend imports only the
  delivery boundary and never inspects CV or facts fields.
- `@cv/schema-editor` walks Effect schema ASTs at runtime. It has no CV-specific
  field knowledge.
- `@cv/application-registry-artifact-store` stores immutable, content-addressed
  bytes in private R2. D1 stores identities, relationships, state, hashes, and
  byte lengths—not CV content fields.
- `@cv/facts-release` deterministically compiles and verifies one-locale facts
  releases. `tools/facts-release` uploads exact bytes, registers the immutable
  release, and advances a versioned channel.
- `@cv/ai-provider` exposes a provider-neutral interface. Its live adapter uses
  Login with ChatGPT and the signed-in user's existing ChatGPT subscription;
  this workspace has no API-key or separately billed OpenAI API path.
- `@cv/renderer` is shared by the management iframe preview, public SSR page,
  and PDF render. The final public URL is also the exact QR target embedded in
  the PDF.

## Tailored application flow

1. Add an application in `not_started` state.
2. Start preparation. The Worker captures the canonical posting URL into an
   immutable snapshot, or records a failed capture that can be refreshed.
3. The browser loads the active reviewed facts release and sends facts, posting
   context, the current document schema, and code-owned authoring guidance to
   the selected ChatGPT-subscription model.
4. Validate and save the opaque draft, edit it through the generic schema
   editor, and preview it locally with the shared renderer.
5. Approve the selected revision and create/reuse the stable public token.
6. Run the Cloudflare PDF Workflow against that exact public URL. Persist the
   resulting PDF in R2, then show the publication as ready in management.
7. A rejection disables the application's public link with the system reason
   `application_rejected`; reopening restores only links disabled for that
   reason. Manual and PDF-failure disables remain in force.

Cover letters use a separate content entry and prompt flow, but reference the
same persisted posting snapshot. AI interaction state is browser-owned and is
cleared when a flow finishes; it is not stored as a backend conversation.

## Local development

Enter the repository's zsh/direnv/Nix shell, install workspaces, and apply the
local D1 migrations:

```sh
bun install
bunx nx run application-registry-api:migrations:apply:local
```

Run the registry Worker and public Worker in separate shells so Wrangler can
resolve the named service binding:

```sh
bunx nx run application-registry-api:dev
bunx nx run cv:dev
```

The management SPA is built into and served by the registry Worker. Direct
`/v1/*` requests require `Authorization: Bearer <REGISTRY_API_TOKEN>`.
Production additionally puts the browser-facing Worker routes behind
Cloudflare Access for the configured owner email.

Useful checks:

```sh
bun run quality:biome
bunx nx run-many -t typecheck test:unit --parallel=6
bunx nx run application-registry-api:test:integration
bunx nx run application-registry-api:test:e2e
bunx nx run cv:test:worker
bunx nx run cv:build
```

## Deployment and legacy coexistence

The first v2 deployment order is:

1. apply D1 migrations and deploy `cv-application-registry` without a public
   hostname;
2. deploy `cv-public`, whose one-way service binding targets the registry's
   `CvPublicResolver` entrypoint;
3. apply Terraform, which configures the personal management Access policy
   before enabling the registry hostname, then attaches only
   `CV_WEB_HOST/c/*` to `cv-public`;
4. publish and activate a facts release from the facts-only `cv-content`
   repository.

The old Pages resources use Terraform `removed` blocks with `destroy = false`.
Keep them through the first successful production apply; the deployed Pages
project and hostname remain live but unmanaged afterward. See
`docs/legacy-migration/README.md`, `apps/cv/README.md`,
`apps/application-registry-api/README.md`, and `terraform/README.md` for
operational detail.

Remote deployment requires Cloudflare, Infisical, and Terraform Cloud
credentials. Local builds and Miniflare integration tests do not.
