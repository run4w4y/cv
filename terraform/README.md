# CV Infrastructure

This directory contains the infrastructure that belongs to the CV workspace
itself: secret layout, the public CV Worker's path overlay, analytics connector
routing, the application registry's D1/R2/KV/Access resources and Worker
routing, and Grafana dashboards.
It does not provision a general cloud account, a Grafana server, or a content
repository.

The live configuration uses Terragrunt and HCP Terraform state. Each stack
generates a Terraform Cloud backend from `TF_CLOUD_ORGANIZATION`,
`TF_CLOUD_PROJECT`, and a fixed workspace name.

## Stacks

- `live/prod/infisical`: creates the `/cv` Infisical folder tree, placeholder
  secrets that operators fill manually, generated v2 runtime secrets, and the
  one frozen-v1 analytics compatibility key.
- `live/prod/cloudflare`: preserves the former Pages deployment outside
  Terraform, overlays `cv-public` only on `CV_WEB_HOST/c/*`, exposes managed
  Workers through their Cloudflare-provided `workers.dev` URLs, and creates D1,
  R2, Workers KV, and Cloudflare Access resources. Wrangler deploys Worker code,
  service, storage, and Queue bindings, migrations, and runtime secrets
  separately.
- `live/prod/grafana`: creates separate analytics and applications folders,
  Infinity datasources, and dashboards backed by the analytics connector and
  application registry API.

Terraform Cloud workspace names:

- `cv-infisical`
- `cv-cloudflare`
- `cv-grafana`

Forks can keep those names or change the `name` values in the live
`terragrunt.hcl` files.

## External Prerequisites

- Terraform, Terragrunt, and the Infisical CLI.
- An Infisical project and environment.
- The existing Cloudflare Pages deployment and its proxied public-CV DNS
  hostname. This migration preserves that hostname; it does not create a base
  Pages project or DNS record for a clean account.
- A Cloudflare Zero Trust organization/team domain initialized for the account
  before Terraform creates the single-owner Access applications.
- R2, Workers KV, Cloudflare Queues, and Browser Rendering enabled on that
  Cloudflare account.
- A Grafana instance. This repository provisions Grafana resources, not the
  Grafana server itself.
- The `yesoreyeram-infinity-datasource` plugin installed in Grafana before
  applying the Grafana stack.
- HCP Terraform organization/project values, unless you adapt the generated
  backend to another state backend.

Set the `cv-infisical`, `cv-cloudflare`, and `cv-grafana` HCP Terraform
workspaces to **Execution Mode: Local**. This repository uses HCP Terraform for
state, while provider authentication comes from the local Infisical-backed
shell and the Grafana stack reads repository-local dashboard templates. Remote
workspace execution is not supported without separately forwarding those
credentials and packaging the local template inputs.

The repository's `terraform/live/prod/.envrc` can load `/cv/deploy`,
`/cv/analytics`, `/cv/application-registry`, and `/cv/grafana` through
Infisical. Forks should replace the checked-in Terraform Cloud defaults there
or set `TF_CLOUD_ORGANIZATION` and `TF_CLOUD_PROJECT` in their shell before
running Terragrunt.

## Bootstrap

Start with these values in `.env.local` or your shell:

```dotenv
INFISICAL_PROJECT_ID=...
INFISICAL_ENV=prod
INFISICAL_HOST=https://app.infisical.com
TF_CLOUD_ORGANIZATION=...
TF_CLOUD_PROJECT=...
```

Log in and load the shell:

```sh
infisical login
direnv allow
```

Create the Infisical folder and secret skeleton first:

```sh
cd terraform/live/prod/infisical
terragrunt init
terragrunt plan
terragrunt apply
```

Then fill the user-owned placeholder secrets in Infisical.

Open Cloudflare's **Workers & Pages** landing page once before filling the
Worker settings. Cloudflare creates the account-level `workers.dev` subdomain
on that first visit. Its label is the middle portion of any default Worker URL:
`<worker>.<account-label>.workers.dev`.

Required under `/cv/deploy`:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN`, the account label shown in
  `<worker>.<account-label>.workers.dev`, without `.workers.dev`
- `CV_WEB_HOST`, for example `cv.example.com`
- `DOMAIN_NAME`, for example `example.com`

On an existing deployment, Terraform renames the former
`CV_ANALYTICS_CONNECTOR_HOSTNAME` secret to
`CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN` without destroying the protected
secret. Replace its old custom-hostname value with the new account label before
applying the Cloudflare stack.

The registry D1 primary defaults to Cloudflare's `weur` location hint. Override
it with `APPLICATION_REGISTRY_DB_PRIMARY_LOCATION_HINT` (`wnam`, `enam`,
`weur`, `eeur`, `apac`, or `oc`), or set it to an empty string to let
Cloudflare choose the primary location.

The private R2 bucket defaults to `CV_OBJECTS_BUCKET_NAME=cv-objects` and the
`weur` location hint; override the latter only at first creation with
`CV_OBJECTS_BUCKET_LOCATION`. The Workers KV namespace title defaults to
`CHATGPT_SESSIONS_NAMESPACE_TITLE=cv-chatgpt-sessions`. Terraform syncs the
resulting bucket name and namespace ID back to `/cv/application-registry` for
Wrangler.

Reviewed facts use a separate private bucket, defaulting to
`FACTS_R2_BUCKET=cv-facts` and `FACTS_R2_BUCKET_LOCATION=weur`. It has no
Worker binding, `r2.dev` endpoint, custom domain, or project hostname. Clients
use `https://<account-id>.r2.cloudflarestorage.com` and signed S3 requests.

Required under `/cv/analytics`:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`

Required under `/cv/application-registry`:

- `APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL`, the single owner email
  allowed through Cloudflare Access. Leaving it empty disables Access
  provisioning and leaves the browser UI and its same-origin registry BFF
  unprotected, so the production personal deployment must set it.

The Infisical stack generates `REGISTRY_API_TOKEN` and
`CHATGPT_SESSION_SECRET`. The latter encrypts Login with ChatGPT sessions before
they are stored in Workers KV; it is not an OpenAI API key and this deployment
does not configure an API-billed provider. The Cloudflare stack later writes
the Worker URL, D1 identifiers, R2 bucket name, KV namespace ID, Worker name,
and its Access-protected `workers.dev` state into the same folder.

Required under `/cv/content`:

- `CONTENT_REPO_TOKEN`, a GitHub token or GitHub App installation token that CI
  can use to read your private content repository.

The Cloudflare stack creates two permanent account tokens restricted to the
facts bucket: Object Read for the owner-only management browser and Object Read
& Write for the publisher. It derives their S3 secrets according to Cloudflare's
R2 token contract and writes `FACTS_R2_*` plus `VITE_FACTS_R2_*` into this
folder. The Terraform Cloud state is therefore sensitive.

`PUBLIC_CV_FULL_ACCESS_EMAIL` is a frozen-v1 placeholder retained only so
Terraform preserves the existing Infisical object. CV v2 does not read it and
it does not need a new value.

Required under `/cv/grafana`:

- `GRAFANA_AUTH`, usually a Grafana service-account token.
- `GRAFANA_URL`

The Infisical stack generates these secrets:

- `/cv/analytics:GRAFANA_CONNECTOR_TOKEN`
- `/cv/application-registry:CHATGPT_SESSION_SECRET`
- `/cv/application-registry:REGISTRY_API_TOKEN`
- `/cv/content:PRIVATE_CONTENT_AUDIENCE_KEY`, used only to decode frozen-v1
  private audience paths in the existing analytics history

`CONTENT_ID_SALT` and `PRIVATE_CONTENT_ROOT_KEY` have been relinquished: the v2
Infisical module neither creates nor rotates them. Existing copies may remain
in Infisical for forensic recovery of the frozen Pages generation, but no v2
build, Worker, or workflow consumes them.

Reload the shell after editing or generating secrets:

```sh
direnv reload
```

The full Cloudflare apply includes route and script-subdomain resources that
expect the named Workers to exist. Bootstrap storage first, then deploy both
Workers, and only then run the full apply. Start by inspecting the complete
change set:

```sh
cd terraform/live/prod/cloudflare
terragrunt init
terragrunt plan
```

For the existing v1 installation, create only the registry's durable resources
and sync the values required by Wrangler:

```sh
terragrunt apply \
  -target=infisical_secret.application_registry_database_id \
  -target=infisical_secret.application_registry_database_name \
  -target=infisical_secret.application_registry_worker_name \
  -target=infisical_secret.cv_objects_bucket_name \
  -target=infisical_secret.facts_r2 \
  -target=infisical_secret.chatgpt_sessions_namespace_id
direnv reload
```

Those targeted Infisical resources pull their D1, R2, and KV dependencies into
the same apply. Terraform's targeted-apply warning is expected here; this is a
one-time dependency bootstrap, not the steady-state deployment process. It
intentionally does not create
`APPLICATION_REGISTRY_WORKERS_DEV_ENABLED`; the first Wrangler deployment
therefore creates the registry Worker with `workers_dev = false`. Its named
entrypoints remain available to the public CV Worker's service binding, but the
management SPA and same-origin bearer-injecting BFF have no public hostname yet.

This stack creates:

- a `cv-public` Worker route for exactly `CV_WEB_HOST/c/*`;
- the public CV Worker's `workers.dev` exposure;
- the analytics connector Worker's `workers.dev` exposure and derived URL;
- the `cv-application-registry` D1 database, protected from accidental
  Terraform destruction;
- the private `cv-objects` R2 bucket, protected from accidental Terraform
  destruction, for job snapshots, CV revisions, and PDFs;
- the private `cv-facts` R2 bucket and separate bucket-scoped reader/publisher
  credentials, all protected from accidental Terraform destruction;
- the `cv-chatgpt-sessions` Workers KV namespace for encrypted ChatGPT auth
  sessions and short-lived proxy rate counters;
- a single-owner Cloudflare Access application for the management UI and BFF,
  plus a narrower `/v1/*` bypass whose requests still require the registry
  bearer token;
- the application registry Worker's `workers.dev` exposure and derived URL,
  enabled only after those Access applications exist;
- `ANALYTICS_CONNECTOR_URL` in `/cv/analytics` when Infisical sync is enabled;
- `REGISTRY_API_URL`, `APPLICATION_REGISTRY_DB_ID`,
  `APPLICATION_REGISTRY_DB_NAME`, `APPLICATION_REGISTRY_WORKER_NAME`,
  `APPLICATION_REGISTRY_WORKERS_DEV_ENABLED`, `CV_OBJECTS_BUCKET_NAME`, and
  `CHATGPT_SESSIONS_KV_ID` in
  `/cv/application-registry` when Infisical sync is enabled;
- `CV_PUBLIC_WORKER_NAME`, `CV_PUBLIC_REGISTRY_SERVICE_NAME`,
  `CV_PUBLIC_RESOLVER_ENTRYPOINT`, and `CV_PUBLIC_ROUTE_PATTERN` in `/cv/deploy`
  when Infisical sync is enabled.
- `FACTS_R2_*` publisher values and `VITE_FACTS_R2_*` direct-reader values in
  `/cv/content` when Infisical sync is enabled.

The Cloudflare provider can create R2 buckets but does not expose a writable
R2 CORS resource. The registry deployment therefore applies the checked-in
direct-read policy with Wrangler: only the Access-protected management origin
and `http://localhost:4300` may issue browser `GET`/`HEAD` requests. CORS does
not grant object access; every request still needs the bucket-scoped SigV4
credential.

The old Pages project, custom-domain attachment, and proxied CNAME are frozen
in place. The `removed` blocks in `modules/cloudflare-cv/pages.tf` remove them
from Terraform state with `destroy = false`; keep those blocks until that state
transition has been applied successfully in production. Pages continues to
serve every path other than the Terraform-owned `/c/*` overlay.

Build the management assets with their final public-CV base URL, apply the
registry schema, and deploy the registry Worker with both runtime secrets:

```sh
VITE_CV_PUBLIC_BASE_URL="https://${CV_WEB_HOST}/c" \
  bunx nx run application-registry-management:build
bunx nx run application-registry-api:migrations:apply:remote
bunx nx run application-registry-api:deploy
```

Deploy the public Worker only after the registry exists, because its production
version contains a named `CV_PUBLIC_RESOLVER` binding to the registry's
`CvPublicResolver` entrypoint:

```sh
bunx nx run cv:deploy
```

The full Cloudflare stack also manages the existing analytics Worker's
`workers.dev` exposure. Before the full apply, confirm that the Worker named by
`ANALYTICS_CONNECTOR_WORKER_NAME` (default `cv-analytics-connector`) still
exists. The current v1 installation already has it. If it has been removed,
run the `CI` workflow on the intended branch with deployment target
`analytics`; that deployment restores the Worker and its runtime secrets.

After the targeted storage apply, deploy the registry and then `cv-public`
before the full Cloudflare apply attaches Access, the path route, and managed
script-subdomain settings:

```sh
cd terraform/live/prod/cloudflare
terragrunt apply
direnv reload
```

The full apply creates both registry Access applications before enabling the
registry's `workers.dev` hostname, then syncs
`APPLICATION_REGISTRY_WORKERS_DEV_ENABLED=true` so later Wrangler deployments
preserve that protected endpoint. Until that apply, the registry has no public
management/BFF hostname and the frozen Pages project continues serving the
whole CV hostname. CI enforces the same registry-before-CV order for main,
`all`, and CV-only deployments. There is intentionally no reverse
registry-to-CV preview binding. The one-time targeted apply above is required
because the registry deployment needs the Terraform-created D1, R2, and KV
identifiers, while the full Terraform apply needs both Worker scripts to exist.

Terraform owns D1, R2, KV, Access, route overlays, dedicated `workers.dev`
exposure resources, derived URLs, and Infisical writes. Wrangler owns Worker
creation and deployed versions, observability configuration, the public
Worker's one-way service binding, registry storage and Browser Run bindings,
PDF Queue bindings, migrations, and runtime secrets. The deployment workflow
creates the main PDF queue and dead-letter queue when they do not yet exist.

Apply Grafana after the analytics connector URL, application registry URL and
token, and Grafana token are available:

```sh
cd terraform/live/prod/grafana
terragrunt init
terragrunt plan
terragrunt apply
```

The applications dashboard provides lifecycle KPIs, status/stage/priority
breakdowns, a complete applications table, follow-up queue, and time-ranged
recent activity. The table has Grafana-owned Active, Interest, To apply, and
Archive presets. One multi-property Grafana variable supplies each preset's
generic registry filters and ordering to a single applications query. Company,
lifecycle, stage, priority, and label controls filter the assembled view in
Grafana. Follow-up timing is derived from `followUpAt` against one dashboard
request timestamp. Lifecycle and target-stage values are color-coded. The
compensation currency control asks the applications endpoint to convert
displayed summaries while preserving original stored values.

Empty registries retain table schemas and zero-valued KPIs. The applications
and recent-activity queries use Infinity cursor pagination with 100 rows per
request, following `pageInfo.nextCursor` through the `after` query parameter for
up to five continuation pages.

The applications table also exposes confirmed row actions for lifecycle
events, notes, labels, contact and research events, and follow-up scheduling.
They use the application version shown in the row for optimistic concurrency
where the registry command supports it. Note bodies and sources are entered as
JSON strings, labels as a JSON string array, and event/status values use the
registry contract's literal names. Actions call the registry through Grafana's
same-origin datasource proxy, which keeps the shared bearer token in the
provisioned datasource rather than the dashboard JSON. The dashboard refreshes
every 30 seconds after mutations; refresh manually when the updated row is
needed immediately.

## Cloudflare Permissions

The Cloudflare deploy token in `/cv/deploy:CLOUDFLARE_API_TOKEN` needs
permissions for both Terraform-managed resources and Wrangler deployments:

- Account: `Workers Scripts` `Write`
- Account: `D1` `Write`
- Account: `Workers KV Storage` `Write`
- Account: `Workers R2 Storage` `Write`
- Account: `Account API Tokens` `Write`
- Account: `Access: Apps and Policies Write`
- Account: `Account Settings` `Read`
- Zone: `DNS` `Write`
- Zone: `Workers Routes` `Write`
- Zone: `Zone` `Read`

Scope account permissions to the target Cloudflare account and zone permissions
to the target CV domain's zone.

The Cloudflare analytics runtime token in
`/cv/analytics:CLOUDFLARE_ANALYTICS_API_TOKEN` needs enough access to query
GraphQL analytics:

- Account: `Account Analytics` `Read`
- Zone: `Analytics` `Read`, sometimes shown by Cloudflare as `Zone Analytics`
- Zone resources: include the CV domain's zone

On the Cloudflare Free plan, prefer first-level Worker hostnames such as
`analytics.example.com` and `applications.example.com`. Deeper names may not be
covered by Universal SSL.

## GitHub Actions

The workflows fetch deployment values from Infisical through OIDC. Configure the
production environment with:

- `INFISICAL_IDENTITY_ID`
- `INFISICAL_PROJECT_SLUG`

Configure repository variables:

- `INFISICAL_ENV`, optional, defaults to `prod`
- `INFISICAL_HOST`, optional, defaults to `https://app.infisical.com`
- `CV_PUBLIC_WORKER_NAME`, optional, defaults to `cv-public` and is later synced
  to Infisical by the Cloudflare stack
- `CV_PUBLIC_REGISTRY_SERVICE_NAME`, optional override for the Terraform-synced
  application registry Worker name
- `CV_PUBLIC_RESOLVER_ENTRYPOINT`, optional, defaults to `CvPublicResolver`
- `CV_PUBLIC_COMPATIBILITY_DATE`, optional, defaults in the public Worker
  Wrangler config generator
- `ANALYTICS_CONNECTOR_WORKER_NAME`, optional, defaults to
  `cv-analytics-connector`
- `ANALYTICS_CONNECTOR_COMPATIBILITY_DATE`, optional, defaults in the Wrangler
  config generator
- `APPLICATION_REGISTRY_COMPATIBILITY_DATE`, optional, defaults in the registry
  Wrangler config generator

The registry deployment reads these Infisical values in addition to the
account settings: `APPLICATION_REGISTRY_DB_ID`,
`APPLICATION_REGISTRY_DB_NAME`, `APPLICATION_REGISTRY_WORKER_NAME`,
`CHATGPT_SESSIONS_KV_ID`, `CHATGPT_SESSION_SECRET`, `CV_OBJECTS_BUCKET_NAME`,
`CV_WEB_HOST`, `FACTS_R2_BUCKET`, `REGISTRY_API_URL`, `REGISTRY_API_TOKEN`, and
the four `VITE_FACTS_R2_*` build values. After the full Cloudflare apply it also
reads Terraform-synced `APPLICATION_REGISTRY_WORKERS_DEV_ENABLED=true`; before
that point the default is `false`. `CV_PDF_QUEUE_NAME` and `CV_PDF_DLQ_NAME`
optionally select the PDF job and dead-letter queues; they default to
`cv-pdf-generation` and `cv-pdf-generation-dead-letter`.

The CV deploy workflow contains no content-repository checkout. Reviewed facts
are published independently to their private static bucket; tailored document
revisions reach the registry through the management flow. Deploying `cv-public`
only publishes the schema-aware SSR runtime.

## Secret State

Worker runtime secrets are deployed with Wrangler, not Terraform:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `GRAFANA_CONNECTOR_TOKEN`
- `PRIVATE_CONTENT_AUDIENCE_KEY`, frozen-v1 analytics compatibility only
- `CHATGPT_SESSION_SECRET`
- `REGISTRY_API_TOKEN`

The application registry D1 database ID, R2 bucket name, KV namespace ID, and
Access-protected `workers.dev` state are deployment values rather than
credentials. Terraform writes them to Infisical so the generated production
Wrangler configuration can bind the correct resources and preserve the safe
exposure state without checking environment-specific values into source
control.

The Cloudflare Terraform stack manages `workers.dev` exposure, derived
deployment values, durable infrastructure, and the two scoped R2 tokens. Treat
HCP Terraform state as sensitive:
Infisical and Grafana provider state can include generated or provider-managed
secret values.

## Modules

- `modules/infisical-cv`: folder tree, placeholder secrets, generated analytics
  and application-registry secrets, and frozen-v1 compatibility state.
- `modules/cloudflare-cv`: frozen Pages state removal, public CV and analytics
  Worker routing, application registry D1/R2/KV/Access resources, the isolated
  facts bucket and scoped tokens, and registry Worker routing.
- `modules/grafana-cv`: analytics and application-registry Infinity
  datasources, dashboard folders, and dashboard template bindings.
