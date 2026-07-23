# CV project infrastructure

This directory owns project-specific JetStream resources, Infisical entries,
and Cloudflare Access/cache policy. Cluster-wide Nomad, Consul, Vault,
PostgreSQL, MinIO, NATS, Chromium, DNS, Tunnel, and Traefik configuration
belongs to `~/infrastructure`.

## JetStream topology

`terraform/live/prod/jetstream` owns the `REGISTRY_EVENTS` stream and
`registry-pdf-worker` and `registry-cache-invalidator` durable pull consumers.
Runtime credentials cannot create or modify these resources.

Use a temporary operator Connect upstream for plans and applies:

```sh
consul connect proxy -service operator-root -upstream nats:14222

cd terraform/live/prod/jetstream
NATS_ADMIN_SERVER=nats://127.0.0.1:14222 \
NATS_ADMIN_USER="$(vault kv get -field=username secret/nats/root-credentials)" \
NATS_ADMIN_PASSWORD="$(vault kv get -field=password secret/nats/root-credentials)" \
terragrunt plan
```

Keep the HCP `cv-jetstream` workspace in local execution mode. The three
ephemeral provider values are not persisted in Terraform state.

## Cloudflare

`terraform/live/prod/cloudflare` retains only Cloudflare capabilities that sit
in front of the self-hosted services:

- owner-only Access for the registry management UI;
- a public Tunnel route for the bearer-authenticated registry API, without an
  Access application;
- a cache rule for public `/c/*` pages while excluding previews, internals,
  Next.js assets, non-GET requests, and query strings;
- synchronized self-hosted registry and public-CV URLs.

Analytics are read directly by the registry API from Cloudflare GraphQL. Cache
invalidation is performed by a dedicated JetStream consumer with a separate
Cloudflare purge credential.

The module deploys no Worker or Pages application runtime; all application code
runs on Nomad.

The production inputs are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ZONE_ID`, `DOMAIN_NAME`, `CV_WEB_HOST`,
`APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL`, and the Infisical settings.
The Terraform token needs Access and zone Cache Rules write permissions.

Only deployable roots under `terraform/live` own `.terraform.lock.hcl` files.
Reusable modules intentionally do not carry provider locks.

## Infisical legacy-content migration

The Infisical module moves retained child folders to a new resource address and
then forgets the obsolete `/cv/content` folder and
`PRIVATE_CONTENT_AUDIENCE_KEY` without deleting either remote object. This
preserves the original destroy protection and makes the first apply
non-destructive. After confirming that no deployment reads the legacy key,
remove the unmanaged key and empty folder manually in Infisical.

## Validation

```sh
terraform fmt -recursive terraform/modules

validation_root="$(mktemp -d)"
rsync -a --exclude=.terraform --exclude=.terragrunt-cache \
  terraform/modules/ "$validation_root/modules/"
for module in "$validation_root"/modules/*; do
  terraform -chdir="$module" init -backend=false -input=false
  terraform -chdir="$module" validate
done

terragrunt hcl format --check --working-dir terraform/live/prod
terragrunt hcl validate \
  --working-dir terraform/live/prod \
  --tf-path terraform \
  --inputs \
  --strict

image="registry.example.test/cv@sha256:0000000000000000000000000000000000000000000000000000000000000000"
for pack in nomad/packs/*; do
  render_args=(--parser-v1 --var "docker_image=$image")
  if [[ "$pack" == "nomad/packs/cv-web" ]]; then
    render_args+=(--var "deployment_id=validation")
  fi
  nomad-pack render "$pack" "${render_args[@]}" >/dev/null
done
```
