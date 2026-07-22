# CV project infrastructure

This directory owns project-specific Infisical and Cloudflare policy plus the
application registry's JetStream topology. Cluster-wide DNS/Tunnel
configuration, Nomad, Consul, Vault, PostgreSQL, MinIO, and the NATS server and
authorization belong to `~/infrastructure`; CV application jobs and packs
belong to this repository under `nomad/`.

## JetStream topology

`terraform/live/prod/jetstream` owns the `REGISTRY_EVENTS` stream and the
`registry-pdf-worker` durable pull consumer. Apply it after the infrastructure
repository has deployed a healthy NATS service and before enabling any CV
application allocation. Runtime application credentials cannot create or
modify streams or consumers.

Start an operator Connect upstream, read the existing NATS root credential from
Vault into the apply process, and inspect the plan:

```sh
consul connect proxy -service operator-root -upstream nats:14222

cd terraform/live/prod/jetstream
NATS_ADMIN_SERVER=nats://127.0.0.1:14222 \
NATS_ADMIN_USER="$(vault kv get -field=username secret/nats/root-credentials)" \
NATS_ADMIN_PASSWORD="$(vault kv get -field=password secret/nats/root-credentials)" \
terragrunt plan
```

The ephemeral Terraform variables supply credentials directly to the provider;
they are not persisted in the `cv-jetstream` Terraform state. Both resources
have `prevent_destroy` enabled. Because the provider replaces rather than edits
durable consumers, an intentional contract change must introduce a versioned
consumer and migrate it explicitly.

Keep the HCP `cv-jetstream` workspace in local execution mode. The provider
must reach NATS through the local Consul upstream shown above, and the three
ephemeral `NATS_ADMIN_*` values exist only in that local apply process.

## What remains on Cloudflare

The `cloudflare-cv` module manages:

- the analytics connector Worker's route or `workers.dev` exposure;
- the `cv-public` Worker's `workers.dev` exposure and exact
  `CV_WEB_HOST/c/*` overlay;
- owner-only Access for the self-hosted registry management origin;
- bypass applications for the registry's bearer-token `/machine/*` API and
  capability-token `/cv-*` publication resolver;
- derived `REGISTRY_API_URL`, `CV_PUBLIC_RESOLVER_URL`, public Worker name, and
  route values in Infisical.

The existing Cloudflare Pages site stays deployed and unmanaged. DNS and the
Tunnel continue routing the Nomad origin through the adjacent infrastructure
stack.

The module no longer creates or configures the registry Worker, D1 runtime,
R2, Queues, or Browser Rendering. The public CV and analytics Workers are the
only retained Workers.

## State transition

The D1 database contains the source data for the one-time PostgreSQL import.
`storage.tf` therefore removes it from Terraform state with `destroy = false`.
After the first successful post-cutover apply and verified import, delete that
`removed` block and retire the database separately.

The R2 buckets are empty and have no migration step. Removing their resource
blocks makes the next full apply delete them. The old registry Worker hostname,
route, and `workers.dev` resources are also removed by that apply. Do not apply
this stack until the self-hosted origin is healthy and the cutover window has
started.

Always inspect the plan. A correct cutover plan should preserve D1 outside
Terraform, remove both R2 buckets, remove old registry Worker exposure, retain
the analytics and `cv-public` resources, and create/update Access for the
Tunnel origin.

## Inputs

The production Terragrunt stack is `terraform/live/prod/cloudflare`. Important
inputs are read from the environment:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and
  `DOMAIN_NAME`;
- `CV_WEB_HOST` and `CV_PUBLIC_WORKER_NAME`;
- `REGISTRY_API_URL`, defaulting to
  `https://registry-origin.${DOMAIN_NAME}`;
- `CV_PUBLIC_RESOLVER_URL`, defaulting to the same Tunnel origin;
- `APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL`;
- `CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN` and the retained Worker exposure
  flags;
- `INFISICAL_PROJECT_ID`, `INFISICAL_ENV`, and `INFISICAL_HOST` when secret
  synchronization is enabled.

`REGISTRY_API_URL` and `CV_PUBLIC_RESOLVER_URL` must be HTTPS origins without a
path. They may be different hostnames; Access applies the public resolver bypass
to the resolver hostname.

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

Run Terragrunt plan only with the production environment loaded:

```sh
cd terraform/live/prod/cloudflare
terragrunt plan
```

No apply is part of repository cleanup. Apply is a deliberate cutover action.

## Cutover sequence

1. Apply and verify `~/infrastructure` so the Tunnel, Traefik, PostgreSQL,
   MinIO, NATS, Vault policies, Consul intentions, and reduced sidecar budgets
   are ready.
2. Apply `terraform/live/prod/jetstream` and verify the stream and durable
   consumer before starting application allocations.
3. Deploy the disabled Nomad jobs from this repository and verify the API at
   the origin hostname.
4. Stop D1 writes, take a permission-restricted export, and import it with
   `tools/application-registry-migration`.
5. Enable the API/BFF and background jobs, deploy `cv-public` with
   `CV_PUBLIC_RESOLVER_URL`, then inspect and apply this Cloudflare stack.
6. Verify Access, `/machine/*`, `/cv-*`, `/c/*`, analytics, PDF generation, and
   the frozen Pages routes before retiring D1 and deleting the migration tool.

## Permissions

The Terraform Cloudflare token needs account Access application/policy write
permission and zone Workers Routes write permission. It may also need the
legacy R2 delete permission for the one cutover apply. Wrangler's public-Worker
deployment token continues to need Workers Scripts write permission.

The runtime analytics token remains separate and read-only for Zone Analytics;
the Bun API uses it through the framework-neutral
`@cv/cloudflare-analytics-client` package.
