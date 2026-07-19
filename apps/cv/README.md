# Public CV Worker

This Next.js App Router application is the server-rendered public CV surface.
It owns the document renderer and the exact `/c/:token` route. Every other
public path returns `404`, allowing the existing Cloudflare Pages project to
continue serving legacy routes while the Worker route is attached only to
`/c/*`.

The Worker reads enabled publications through the `CV_PUBLIC_RESOLVER` named
service binding. The registry returns opaque bytes and publication metadata;
this application is the schema-owning boundary that validates and renders
`cv.document.v1`.

The public page is a React Server Component and does not define a client
boundary. The management app uses the isolated `/c/_preview` iframe when it
needs interactive previews; that is the only renderer route with client-side
React code. The PDF worker opens the published `/c/:token` page, so PDF output
uses the same deployed renderer as public SSR.

For local development, run the registry Worker and this app in separate
shells so Wrangler can connect the service binding:

```sh
bun x nx run application-registry-api:dev
bun x nx run cv:dev
```

The public Worker never calls a registry URL and never receives a management
bearer token.

## Testing

`@cv/worker-test-kit/cv-public` runs the Wrangler-bundled OpenNext Worker in
Miniflare and
supplies a configurable in-process `CV_PUBLIC_RESOLVER` service. The CV test
keeps its document examples and rendering assertions locally while the shared
package owns module loading, Worker composition, resolver responses, and
cleanup.

```sh
bun x nx run cv:test:worker
```

## Production deployment

The existing Cloudflare Pages deployment is deliberately frozen and no longer
managed by this repository. Cloudflare continues to send every legacy path to
Pages. Terraform attaches the new Worker only to `CV_WEB_HOST/c/*`; neither the
Worker's source config nor its deployment config declares a route.

Builds use OpenNext to produce the deployable Worker and immutable assets under
`.open-next`. The production config writer enables Cloudflare Workers Cache and
emits the registry resolver binding:

```sh
bun x nx run cv:build
bun apps/cv/scripts/write-wrangler-config.ts \
  apps/cv/wrangler.deploy.jsonc
bun apps/cv/scripts/deploy.ts apps/cv/wrangler.deploy.jsonc
```

`bun x nx run cv:deploy` performs those steps in order. Production settings are
read from:

- `CV_PUBLIC_WORKER_NAME`, default `cv-public`;
- `CV_PUBLIC_REGISTRY_SERVICE_NAME`, falling back to
  `APPLICATION_REGISTRY_WORKER_NAME` and then `cv-application-registry`;
- `CV_PUBLIC_RESOLVER_ENTRYPOINT`, default `CvPublicResolver`;
- `CV_PUBLIC_COMPATIBILITY_DATE`, default `2026-07-19`;
- `CV_REVALIDATION_SECRET`, required for authenticated invalidation.

The public Worker binds to the registry resolver for reads. The registry has a
separate binding back to the public Worker only to invalidate a token after a
staged revision or availability change; preview documents never cross that
binding.
Public pages render dynamically on a cache miss. The outer Worker gives only
successful `/c/:token` responses a five-minute edge TTL and a token-specific
cache tag; browsers must revalidate, and previews, missing pages, and failures
are never shared. Publication changes call the owning Worker's global purge API
for the exact token tag. On a first deployment, deploy the registry Worker
first, then `cv-public`, and only then apply the Terraform route overlay. Until
that route exists, the frozen Pages deployment continues handling the entire
hostname.
