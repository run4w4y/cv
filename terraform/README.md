# CV Infrastructure

This directory contains the infrastructure that belongs to the CV workspace
itself: secret layout, static-site hosting, analytics connector routing, and a
Grafana dashboard. It does not provision a general cloud account, a Grafana
server, or a content repository.

The live configuration uses Terragrunt and HCP Terraform state. Each stack
generates a Terraform Cloud backend from `TF_CLOUD_ORGANIZATION`,
`TF_CLOUD_PROJECT`, and a fixed workspace name.

## Stacks

- `live/prod/infisical`: creates the `/cv` Infisical folder tree, placeholder
  secrets that operators fill manually, and generated secrets used by builds,
  private links, and Grafana auth.
- `live/prod/cloudflare`: creates the Cloudflare Pages project/domain/DNS record
  for the static CV site and the Cloudflare Worker resource plus Worker Custom
  Domain or route for the analytics connector. Wrangler deploys Worker code and
  runtime secrets separately.
- `live/prod/grafana`: creates a Grafana folder, Infinity datasource, and starter
  analytics dashboard backed by the analytics connector.

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
`/cv/analytics`, and `/cv/grafana` through Infisical. Forks should replace the
checked-in Terraform Cloud defaults there or set `TF_CLOUD_ORGANIZATION` and
`TF_CLOUD_PROJECT` in their shell before running Terragrunt.

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

Required under `/cv/deploy`:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CV_ANALYTICS_CONNECTOR_HOSTNAME`, for example `analytics.example.com`
- `CV_WEB_HOST`, for example `cv.example.com`
- `DOMAIN_NAME`, for example `example.com`

Required under `/cv/analytics`:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`

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
- the analytics connector Worker script resource;
- either a Worker Custom Domain or Worker route;
- `ANALYTICS_CONNECTOR_URL` in `/cv/analytics` when Infisical sync is enabled.

Apply Grafana after the analytics connector URL and Grafana token are available:

```sh
cd terraform/live/prod/grafana
terragrunt init
terragrunt plan
terragrunt apply
```

## Cloudflare Permissions

The Cloudflare deploy token in `/cv/deploy:CLOUDFLARE_API_TOKEN` needs
permissions for both Terraform-managed resources and Wrangler deployments:

- Account: `Workers Scripts` `Write`
- Account: `Pages` `Write`
- Zone: `DNS` `Write`
- Zone: `Zone` `Read`
- Zone: `Workers Routes` `Write`, only when using
  `CV_ANALYTICS_CONNECTOR_ROUTE_PATTERN` instead of a Worker Custom Domain

Scope account permissions to the target Cloudflare account and zone permissions
to the target CV domain's zone.

The Cloudflare analytics runtime token in
`/cv/analytics:CLOUDFLARE_ANALYTICS_API_TOKEN` needs enough access to query
GraphQL analytics:

- Account: `Account Analytics` `Read`
- Zone: `Analytics` `Read`, sometimes shown by Cloudflare as `Zone Analytics`
- Zone resources: include the CV domain's zone

On the Cloudflare Free plan, prefer a first-level Worker hostname such as
`analytics.example.com`. Deeper names such as `analytics.cv.example.com` may not
be covered by Universal SSL.

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

Forks should update the content checkout in `.github/workflows/deploy-cv.yml` so
it clones their content repository. A separate content repository can dispatch
the CV deploy workflow after content changes by sending a `content-updated`
repository dispatch event.

## Secret State

Worker runtime secrets are deployed with Wrangler, not Terraform:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `GRAFANA_CONNECTOR_TOKEN`
- `PRIVATE_CONTENT_AUDIENCE_KEY`

The Cloudflare Terraform stack should only manage the Worker resource, domain or
route, and non-secret vars. Treat HCP Terraform state as sensitive anyway:
Infisical and Grafana provider state can include generated or provider-managed
secret values.

## Modules

- `modules/infisical-cv`: folder tree, placeholder secrets, generated content
  and analytics secrets.
- `modules/cloudflare-cv`: Pages project/domain/DNS and analytics Worker
  resource/routing.
- `modules/grafana-cv`: Infinity datasource, dashboard folder, and dashboard
  template binding.
