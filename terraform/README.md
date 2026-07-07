# CV Infrastructure

This directory owns CV-specific infrastructure. Generic host/infrastructure
resources stay in `/path/to/infrastructure`; this repo owns the resources
that only make sense for the CV analytics/dashboard flow.

## Stacks

- `live/prod/infisical`: creates the `/cv/*` Infisical folder and secret shape.
- `live/prod/cloudflare`: creates the Cloudflare Pages project/domain and
  analytics Worker resource, Worker Custom Domain, or route. Worker code
  deployments are handled by Wrangler in CI.
- `live/prod/grafana`: creates the Grafana Infinity datasource, folder, and
  starter CV Analytics dashboard.

Each stack uses its own HCP Terraform workspace:

- `cv-infisical`
- `cv-cloudflare`
- `cv-grafana`

## Bootstrap Order

1. Put these bootstrap values in `.env.local` or your shell:

   ```dotenv
   INFISICAL_PROJECT_ID=...
   INFISICAL_ENV=prod
   TF_CLOUD_ORGANIZATION=run4w4y-infra
   TF_CLOUD_PROJECT=run4w4y-cv
   ```

2. Log in to Infisical and allow direnv:

   ```sh
   infisical login
   direnv allow
   ```

3. Create the Infisical folder/secret skeleton:

   ```sh
   pushd terraform/live/prod/infisical
   terragrunt init
   terragrunt plan
   terragrunt apply
   popd
   ```

4. If the old Infisical stack has already been applied, remove the secrets that
   changed ownership from the `cv-infisical` state before planning again:

   ```sh
   cd terraform/live/prod/infisical
   terragrunt state pull > /tmp/cv-infisical-state-before-derived-secret-move.json

   terragrunt state rm 'infisical_secret.this["/cv/analytics:ANALYTICS_CONNECTOR_URL"]'
   terragrunt state rm 'infisical_secret.this["/cv/analytics:CLOUDFLARE_ZONE_ID"]'
   terragrunt state rm 'infisical_secret.this["/cv/analytics:CV_WEB_HOST"]'
   ```

   Then delete those old placeholder secrets from `/cv/analytics` in the
   Infisical UI. Do not remove `GRAFANA_CONNECTOR_TOKEN` from state; Terraform
   moves that resource to the generated-token resource automatically.

5. Re-apply the Infisical stack so Terraform generates
   `PRIVATE_CONTENT_AUDIENCE_KEY` and `GRAFANA_CONNECTOR_TOKEN`:

   ```sh
   cd terraform/live/prod/infisical
   terragrunt init
   terragrunt plan
   terragrunt apply
   ```

6. Fill the user-owned placeholder secrets in Infisical.

   Required under `/cv/deploy`:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`, scoped for Terraform-managed Cloudflare resources,
     Wrangler Worker deploys, and Pages deploys
   - `CLOUDFLARE_ZONE_ID`
   - `CV_ANALYTICS_CONNECTOR_HOSTNAME`, for example `analytics.example.com`.
     On the Cloudflare Free plan, keep this to a first-level subdomain such as
     `analytics.example.com`; deeper names such as `analytics.cv.example.com`
     are not covered by Universal SSL.
   - `CV_WEB_HOST`, for example `cv.example.com`
   - `DOMAIN_NAME`, for example `example.com`

   Required under `/cv/analytics`:
   - `CLOUDFLARE_ANALYTICS_API_TOKEN`

   Required under `/cv/content`:
   - `CONTENT_REPO_TOKEN`, a token or GitHub App installation token that can
     read `run4w4y/cv-content` during CI.
   - `PUBLIC_CV_FULL_ACCESS_EMAIL`, the public contact email shown in redaction
     notices for full CV access requests.

   Required under `/cv/grafana`:
   - `GRAFANA_AUTH`
   - `GRAFANA_URL`

   Terraform generates these secrets under `/cv/content`:
   - `CONTENT_ID_SALT`
   - `PRIVATE_CONTENT_AUDIENCE_KEY`
   - `PRIVATE_CONTENT_ROOT_KEY`, a 32-byte root key used by TypeScript build
     tooling to derive private profile content keys.

   Terraform manages these `/cv/analytics` values:
   - `ANALYTICS_CONNECTOR_URL`
   - `GRAFANA_CONNECTOR_TOKEN`

   Terraform manages these `/cv/content` values:
   - `CONTENT_ID_SALT`
   - `PRIVATE_CONTENT_AUDIENCE_KEY`
   - `PRIVATE_CONTENT_ROOT_KEY`

7. Reload the shell so generated and edited Infisical values are available:

   ```sh
   direnv reload
   ```

8. Provision the Cloudflare infrastructure:

   ```sh
   pushd terraform/live/prod/cloudflare
   terragrunt init
   terragrunt plan
   terragrunt apply
   popd
   ```

   If this stack previously deployed Worker code through Terraform, remove the
   old code-deployment resources from state once before planning/applying the
   revised stack:

   ```sh
   cd terraform/live/prod/cloudflare
   terragrunt state pull > /tmp/cv-cloudflare-state-before-worker-deploy-handoff.json
   terragrunt state rm cloudflare_worker_version.analytics_connector
   terragrunt state rm cloudflare_workers_deployment.analytics_connector
   ```

   Those commands only stop Terraform from tracking the old Worker version and
   deployment resources. They do not delete the live Worker.

9. Configure GitHub Actions deployment values.

   Required repository variables:
   - `CLOUDFLARE_PAGES_PROJECT`
   - `CV_WEB_BASE_URL`
   - `INFISICAL_IDENTITY_ID`
   - `INFISICAL_PROJECT_SLUG`
   - `INFISICAL_ENV`, optional, defaults to `prod`
   - `INFISICAL_HOST`, optional, defaults to `https://app.infisical.com`

   GitHub Actions fetches Cloudflare, Grafana, and content checkout values from
   Infisical via OIDC at runtime. Pushes to `main`, manual workflow runs, and
   `content-updated` repository dispatches build
   `apps/analytics-connector/dist/index.js`, generate
   `apps/analytics-connector/wrangler.deploy.jsonc`, upload Worker secrets with
   Wrangler, and deploy the Worker and Pages site.

   The private `run4w4y/cv-content` repository also needs
   `CV_PUBLIC_REPO_DISPATCH_TOKEN` as a GitHub secret so it can dispatch this
   repository's workflow after content changes.

10. Provision Grafana:

    ```sh
    pushd terraform/live/prod/grafana
    terragrunt init
    terragrunt plan
    terragrunt apply
    popd
    ```

## External Prerequisites

- Grafana must already be running somewhere. This repo provisions Grafana
  resources, not the Grafana server.
- Install the `yesoreyeram-infinity-datasource` plugin in Grafana before
  applying `live/prod/grafana`.
- The Cloudflare deploy token in `/cv/deploy:CLOUDFLARE_API_TOKEN` needs these
  permission groups:
  - Account: `Workers Scripts` `Write`
  - Account: `Pages` `Write`
  - Zone: `DNS` `Write`
  - Zone: `Zone` `Read`
  - Zone: `Workers Routes` `Write`, only if using `worker_route_pattern`
    instead of a Worker Custom Domain
    Scope the account permissions to the Cloudflare account and the zone
    permissions to the CV domain's zone.
- The Cloudflare analytics runtime token in
  `/cv/analytics:CLOUDFLARE_ANALYTICS_API_TOKEN` needs enough access to query
  GraphQL analytics for the CV zone:
  - Account: `Account Analytics` `Read`
  - Zone: `Analytics` `Read`, scoped to the CV domain's zone. Cloudflare may
    show this as `Zone Analytics` under `Analytics & Logs`.
  - Zone resources: include the CV domain's zone.
- The Grafana service-account token needs permission to manage data sources,
  folders, and dashboards.

## Secret State Note

Worker runtime secrets are deployed through Wrangler, not Terraform. The
Cloudflare Terraform stack should not contain the analytics runtime token or
Grafana connector bearer token after the Worker deployment handoff state removal
above. HCP Terraform state still needs to be treated as sensitive because the
Infisical and Grafana stacks can contain generated or provider-managed secret
values.
