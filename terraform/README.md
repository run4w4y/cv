# CV Infrastructure

This directory contains the infrastructure that belongs to the CV workspace
itself: secret layout, static-site hosting, analytics connector routing, the
application registry's D1 database and Worker routing, and Grafana dashboards.
It does not provision a general cloud account, a Grafana server, or a content
repository.

The live configuration uses Terragrunt and HCP Terraform state. Each stack
generates a Terraform Cloud backend from `TF_CLOUD_ORGANIZATION`,
`TF_CLOUD_PROJECT`, and a fixed workspace name.

## Stacks

- `live/prod/infisical`: creates the `/cv` Infisical folder tree, placeholder
  secrets that operators fill manually, and generated secrets used by builds,
  private links, and Grafana auth.
- `live/prod/cloudflare`: creates the Cloudflare Pages project/domain/DNS record
  for the static CV site, exposes the analytics connector and application
  registry Workers through their Cloudflare-provided `workers.dev` URLs, and
  creates the application registry's D1 database. Wrangler deploys Worker code,
  D1 bindings, migrations, and runtime secrets separately.
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
- A Cloudflare account and zone for the public CV hostname.
- A Grafana instance. This repository provisions Grafana resources, not the
  Grafana server itself.
- The `yesoreyeram-infinity-datasource` plugin installed in Grafana before
  applying the Grafana stack.
- HCP Terraform organization/project values, unless you adapt the generated
  backend to another state backend.

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

Required under `/cv/analytics`:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`

The `/cv/application-registry` folder has no manually maintained secrets. The
Infisical stack generates `REGISTRY_API_TOKEN`; the Cloudflare stack later
writes the Worker URL, D1 identifiers, and Worker name into the same folder.

Required under `/cv/content`:

- `CONTENT_REPO_TOKEN`, a GitHub token or GitHub App installation token that CI
  can use to read your private content repository.
- `PUBLIC_CV_FULL_ACCESS_EMAIL`, the contact email shown in public redaction
  notices.

Required under `/cv/grafana`:

- `GRAFANA_AUTH`, usually a Grafana service-account token.
- `GRAFANA_URL`

The Infisical stack generates these secrets:

- `/cv/content:CONTENT_ID_SALT`
- `/cv/content:PRIVATE_CONTENT_AUDIENCE_KEY`
- `/cv/content:PRIVATE_CONTENT_ROOT_KEY`
- `/cv/analytics:GRAFANA_CONNECTOR_TOKEN`
- `/cv/application-registry:REGISTRY_API_TOKEN`

Reload the shell after editing or generating secrets:

```sh
direnv reload
```

Apply Cloudflare next:

```sh
cd terraform/live/prod/cloudflare
terragrunt init
terragrunt plan
terragrunt apply
```

This stack creates:

- a Cloudflare Pages project;
- the Pages custom domain and proxied CNAME record;
- the analytics connector Worker's `workers.dev` exposure and derived URL;
- the `cv-application-registry` D1 database, protected from accidental
  Terraform destruction;
- the application registry Worker's `workers.dev` exposure and derived URL;
- `ANALYTICS_CONNECTOR_URL` in `/cv/analytics` when Infisical sync is enabled;
- `REGISTRY_API_URL`, `APPLICATION_REGISTRY_DB_ID`,
  `APPLICATION_REGISTRY_DB_NAME`, and `APPLICATION_REGISTRY_WORKER_NAME` in
  `/cv/application-registry` when Infisical sync is enabled.

Reload the shell after the first Cloudflare apply so Wrangler receives those
derived values:

```sh
direnv reload
```

Apply the registry schema and deploy the Worker with its bearer secret:

```sh
bunx nx run application-registry-api:migrations:apply:remote
bunx nx run application-registry-api:deploy
```

Terraform owns the D1 database, dedicated `workers.dev` exposure resources,
derived URLs, and Infisical writes. Wrangler owns Worker creation and deployed
versions, observability configuration, the `APPLICATION_REGISTRY_DB` D1
binding, migrations, and runtime secrets. The registry deploy target publishes
code and `REGISTRY_API_TOKEN` in one Worker version.

Apply Grafana after the analytics connector URL, application registry URL and
token, and Grafana token are available:

```sh
cd terraform/live/prod/grafana
terragrunt init
terragrunt plan
terragrunt apply
```

The applications dashboard provides lifecycle KPIs, status/stage/priority
breakdowns, a complete applications table, follow-up queue, and
time-ranged recent activity. Company, lifecycle, stage, priority, and label
controls share one applications query across panels. Empty registries retain
table schemas and zero-valued KPIs. The applications and recent-activity
queries use Infinity cursor pagination with 100 rows per request, following the
existing endpoints' `nextCursor` through the `after` query parameter for up to
100 pages. Grafana's plugin-wide pagination maximum must permit the same page
count.

## Cloudflare Permissions

The Cloudflare deploy token in `/cv/deploy:CLOUDFLARE_API_TOKEN` needs
permissions for both Terraform-managed resources and Wrangler deployments:

- Account: `Workers Scripts` `Write`
- Account: `D1` `Write`
- Account: `Pages` `Write`
- Zone: `DNS` `Write`
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

- `CLOUDFLARE_PAGES_PROJECT`
- `CV_WEB_BASE_URL`
- `INFISICAL_ENV`, optional, defaults to `prod`
- `INFISICAL_HOST`, optional, defaults to `https://app.infisical.com`
- `ANALYTICS_CONNECTOR_WORKER_NAME`, optional, defaults to
  `cv-analytics-connector`
- `ANALYTICS_CONNECTOR_COMPATIBILITY_DATE`, optional, defaults in the Wrangler
  config generator
- `APPLICATION_REGISTRY_COMPATIBILITY_DATE`, optional, defaults in the registry
  Wrangler config generator

Forks should update the content checkout in `.github/workflows/deploy-cv.yml` so
it clones their content repository. A separate content repository can dispatch
the CV deploy workflow after content changes by sending a `content-updated`
repository dispatch event.

## Secret State

Worker runtime secrets are deployed with Wrangler, not Terraform:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `GRAFANA_CONNECTOR_TOKEN`
- `PRIVATE_CONTENT_AUDIENCE_KEY`
- `REGISTRY_API_TOKEN`

The application registry D1 database ID is not secret. Terraform writes it to
Infisical as `APPLICATION_REGISTRY_DB_ID` so the generated production Wrangler
configuration can bind the correct database without checking an environment-
specific UUID into source control.

The Cloudflare Terraform stack should only manage `workers.dev` exposure,
derived deployment values, and non-secret infrastructure. Treat HCP Terraform
state as sensitive anyway:
Infisical and Grafana provider state can include generated or provider-managed
secret values.

## Modules

- `modules/infisical-cv`: folder tree, placeholder secrets, generated content,
  analytics, and application registry secrets.
- `modules/cloudflare-cv`: Pages project/domain/DNS, analytics Worker routing,
  application registry D1 database, and registry Worker routing.
- `modules/grafana-cv`: analytics and application-registry Infinity
  datasources, dashboard folders, and dashboard template bindings.
