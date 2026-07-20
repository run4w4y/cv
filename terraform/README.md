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

The Infisical stack also generates `/cv/deploy:CV_REVALIDATION_SECRET` once.
Both deployment workflows receive that same value through their recursive
`/cv` export, while the root `.envrc` receives it when loading `/cv/deploy`.
The registry uses it to authenticate targeted invalidation requests to the
public CV Worker; it is not a user-owned placeholder.

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
- `/cv/deploy:CV_REVALIDATION_SECRET`

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
  plus a narrower `/machine/*` bypass whose requests must present the registry
  bearer token explicitly;
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

## First production deployment

Build the management assets with their final public-CV base URL. Then ensure
both PDF queues exist and deploy their private consumer before either side of
the circular service-binding pair. Deploying the idle consumer is safe before
the D1 cutover because no v2 jobs exist yet:

```sh
VITE_CV_PUBLIC_BASE_URL="https://${CV_WEB_HOST}/c" \
  bunx nx run application-registry-management:build
PDF_QUEUE="${CV_PDF_QUEUE_NAME:-cv-pdf-generation}"
PDF_DLQ="${CV_PDF_DLQ_NAME:-cv-pdf-generation-dead-letter}"
node node_modules/wrangler/bin/wrangler.js queues info "$PDF_QUEUE" >/dev/null 2>&1 || \
  node node_modules/wrangler/bin/wrangler.js queues create "$PDF_QUEUE"
node node_modules/wrangler/bin/wrangler.js queues info "$PDF_DLQ" >/dev/null 2>&1 || \
  node node_modules/wrangler/bin/wrangler.js queues create "$PDF_DLQ"
bunx nx run cv-pdf-worker:deploy
```

### Production D1 cutover gate

The remote migrations intentionally replace legacy tables and discard legacy
data that has no v2 representation. Stop here until the owner explicitly
approves that destructive production cutover and the reviewed loss set. An
approval to deploy Workers or Terraform is not an approval to migrate D1.

Close the old management UI before quiescing the Worker and do not reopen or
use it during the wait, backup, migration, or v2 Worker bootstrap. Do not run
mutating CLI, Grafana, or automation requests in that interval either. The old
UI speaks the old schema and must never write after the backup or migration.

For an approved cutover, set `CV_CUTOVER_BACKUP_DIR` to a new absolute
directory on durable private storage. The following commands create it with
owner-only permissions, snapshot the current cron schedule, replace the
schedule through Cloudflare's API with `[]`, and prove that no cron remains:

```sh
: "${CV_CUTOVER_BACKUP_DIR:?set a new absolute private backup directory}"
case "$CV_CUTOVER_BACKUP_DIR" in
  /*) ;;
  *) echo "CV_CUTOVER_BACKUP_DIR must be absolute" >&2; exit 1 ;;
esac
umask 077
mkdir -m 700 "$CV_CUTOVER_BACKUP_DIR"

CV_CUTOVER_WORKER="${APPLICATION_REGISTRY_WORKER_NAME:-cv-application-registry}"
CV_CUTOVER_SCHEDULES_URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${CV_CUTOVER_WORKER}/schedules"

curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.before.json"
jq -e '.success == true and (.result.schedules | type == "array")' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.before.json" >/dev/null

curl --fail-with-body --silent --show-error \
  --request PUT \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data '[]' \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.disable-response.json"
jq -e '.success == true' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.disable-response.json" >/dev/null

curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.disabled.json"
jq -e '.success == true and (.result.schedules | type == "array") and (.result.schedules | length == 0)' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.disabled.json" >/dev/null
```

If the cutover is cancelled before migrations start, restore the saved cron
values and verify that they match the snapshot before resuming v1 operations:

```sh
jq '[.result.schedules[] | {cron: .cron}]' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.before.json" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.restore-body.json"
curl --fail-with-body --silent --show-error \
  --request PUT \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data "@$CV_CUTOVER_BACKUP_DIR/worker-schedules.restore-body.json" \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.restore-response.json"
jq -e '.success == true' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.restore-response.json" >/dev/null
curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.restored.json"
test "$(jq -cS '[.result.schedules[].cron] | sort' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.before.json")" = \
  "$(jq -cS '[.result.schedules[].cron] | sort' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.restored.json")"
```

Do not use that rollback after migrations have started; from that point, repair
forward to the v2 Worker.

Wait at least 30 minutes after that successful empty-schedule verification.
This covers Cloudflare's schedule propagation window and any invocation that
was already running. Keep the old management UI and every other mutation path
idle for the full wait. After 30 minutes, fetch and verify the empty schedule
again:

```sh
curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "$CV_CUTOVER_SCHEDULES_URL" \
  >"$CV_CUTOVER_BACKUP_DIR/worker-schedules.after-wait.json"
jq -e '.success == true and (.result.schedules | type == "array") and (.result.schedules | length == 0)' \
  "$CV_CUTOVER_BACKUP_DIR/worker-schedules.after-wait.json" >/dev/null
```

Only now take a fresh full export. Do not reuse the earlier rehearsal backup.
The export must contain schema and data, be non-empty and mode `600`, and have
a recorded SHA-256 checksum before migrations begin:

```sh
bun apps/application-registry-api/scripts/write-wrangler-config.ts \
  apps/application-registry-api/wrangler.deploy.jsonc
CV_CUTOVER_D1_BACKUP="$CV_CUTOVER_BACKUP_DIR/application-registry-pre-v2.sql"
node node_modules/wrangler/bin/wrangler.js d1 export APPLICATION_REGISTRY_DB \
  --remote \
  --config apps/application-registry-api/wrangler.deploy.jsonc \
  --output "$CV_CUTOVER_D1_BACKUP"
chmod 600 "$CV_CUTOVER_D1_BACKUP"
test -s "$CV_CUTOVER_D1_BACKUP"
test "$(stat -c '%a' "$CV_CUTOVER_D1_BACKUP")" = 600
sha256sum "$CV_CUTOVER_D1_BACKUP" \
  >"$CV_CUTOVER_D1_BACKUP.sha256"
chmod 600 "$CV_CUTOVER_D1_BACKUP.sha256"
sha256sum --check "$CV_CUTOVER_D1_BACKUP.sha256"
```

If any schedule, wait, export, permission, or checksum check fails, do not run
the migration. Once all gates pass, apply the pending remote migrations and
continue directly to the v2 Worker bootstrap below; do not use the old
management UI again:

```sh
bunx nx run application-registry-api:migrations:apply:remote
```

The two Workers have intentional steady-state bindings in both directions:
`cv-public` reads through the registry's `CvPublicResolver` entrypoint, and the
registry invalidates public cache entries through `CV_APP`. Break that cycle
only for the first deployment by omitting `CV_APP` from the initial registry
version, then deploy both steady-state versions in this exact order:

```sh
APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED=false \
  bunx nx run application-registry-api:deploy
bunx nx run cv:deploy
bunx nx run application-registry-api:deploy
```

`APPLICATION_REGISTRY_CV_APP_BINDING_ENABLED` defaults to `true`; do not store
the bootstrap override in Infisical or CI variables. The first command scopes
`false` to that one process. The last command regenerates the config with the
normal `CV_APP` binding now that `cv-public` exists. Re-running any ordinary
registry deployment therefore preserves the steady-state binding.

The full Cloudflare stack also manages the existing analytics Worker's
`workers.dev` exposure. Before the full apply, confirm that the Worker named by
`ANALYTICS_CONNECTOR_WORKER_NAME` (default `cv-analytics-connector`) still
exists. The current v1 installation already has it. If it has been removed,
run the `CI` workflow on the intended branch with deployment target
`analytics`; that deployment restores the Worker and its runtime secrets.

After the targeted storage apply, perform the bootstrap registry → `cv-public`
→ steady-state registry sequence above before the full Cloudflare apply
attaches Access, the path route, and managed script-subdomain settings:

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
whole CV hostname. CI uses the normal binding-enabled registry configuration
and therefore assumes the one-time bootstrap has already completed. The
registry-to-CV binding exists only for authenticated public-cache invalidation;
preview documents never cross it. The targeted apply is required because the
registry deployment needs the Terraform-created D1, R2, and KV identifiers,
while the full Terraform apply needs both Worker scripts to exist.

Terraform owns D1, R2, KV, Access, route overlays, dedicated `workers.dev`
exposure resources, derived URLs, and Infisical writes. Wrangler owns Worker
creation and deployed versions, observability configuration, the public-to-
registry resolver binding, the registry-to-public invalidation binding,
registry storage and Browser Run bindings, PDF Queue bindings, migrations, and
runtime secrets. The deployment workflow creates the main PDF queue and
dead-letter queue when they do not yet exist.

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
status, notes, labels, and follow-up scheduling. They use the application
version shown in the row for optimistic concurrency and send the required
idempotency header. Note actions additionally require a fresh request ID for
each distinct note, so two same-kind notes on an otherwise unchanged row do not
replay one another. Note bodies and sources are entered as JSON strings, labels
as a JSON string array, and status values use the registry contract's literal
names. Removed v1-only contact and research event commands are intentionally
not emulated. Actions call `/machine/api/registry/*` through Grafana's
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
