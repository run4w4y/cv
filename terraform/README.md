# CV project infrastructure

This directory owns project-specific JetStream resources, Infisical entries,
Cloudflare Access/cache policy, and Grafana dashboards. Cluster-wide Nomad,
Consul, Vault, PostgreSQL, MinIO, NATS, Chromium, DNS, Tunnel, and Traefik
configuration belongs to `~/infrastructure`.

## JetStream topology

`terraform/live/prod/jetstream` owns the `REGISTRY_EVENTS` stream and
`registry-pdf-worker` durable pull consumer. Runtime credentials cannot create
or modify either resource.

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
- bypass policies for bearer/capability-token API routes;
- a cache rule for public `/c/*` pages while excluding previews, internals,
  Next.js assets, non-GET requests, and query strings;
- synchronized self-hosted registry and public-CV URLs.

There are no Worker, Pages, database, object-storage, queue, or browser-runtime
resources in this module. Analytics are read directly by the registry API from
Cloudflare GraphQL, and cache invalidation calls Cloudflare's purge API.

The production inputs are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ZONE_ID`, `DOMAIN_NAME`, `CV_WEB_HOST`,
`APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL`, and the Infisical settings.
The Terraform token needs Access and zone Cache Rules write permissions.

## Grafana

`terraform/live/prod/grafana` points both CV dashboards at the self-hosted
registry API. The analytics dashboard queries the registry's Cloudflare-backed
analytics endpoint; no connector service exists.

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
```
