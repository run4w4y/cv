# Application Registry PDF worker

This pack deploys the single Application Registry consumer responsible for PDF
generation. It listens to the durable `registry-pdf-worker` JetStream consumer
for publication-availability and explicit PDF-generation events. For each
event, the process connects to the separately deployed generic `chromium`
service over CDP, creates an isolated browser context, and disconnects after
rendering. The durable consumer remains limited to one in-flight delivery.

The pack is safe to register before cutover because `enabled` defaults to
`false`. Default reservations are 100 CPU / 256 MiB for the worker (bursting to
512 MiB) and 50 CPU / 64 MiB for its shared Envoy sidecar. Chromium and its
shared-memory allocation are owned by the infrastructure repository, not this
pack or the worker image.

Required Vault paths are:

- `secret/data/cv-pdf-worker/postgres-credentials`, backed by the dedicated
  `cv_pdf_worker` PostgreSQL role;
- `secret/data/cv-pdf-worker/minio-credentials`, backed by the dedicated
  `cv-pdf-worker` MinIO user;
- `secret/data/cv-pdf-worker/nats-credentials`, backed by the dedicated
  `cv-pdf-worker` NATS user.

Apply `terraform/live/prod/jetstream` before enabling the allocation. The
worker binds to the existing `registry-pdf-worker` durable consumer and fails
startup if the Terraform-managed consumer is unavailable; it never creates or
updates JetStream resources. The infrastructure repository must also have the
`chromium` Nomad allocation and the `cv-pdf-worker -> chromium` Consul intention
applied before enabling this worker.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-pdf-worker \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/application-registry-pdf-worker@sha256:<digest>'
```
