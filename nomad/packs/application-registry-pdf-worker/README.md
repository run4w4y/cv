# Application Registry PDF worker

This pack deploys the single Application Registry consumer responsible for PDF
generation. It listens to the durable `registry-pdf-worker` JetStream consumer
for publication-availability and explicit PDF-generation events. The process
reuses one Chromium instance, opens a fresh page for each event, and limits the
durable consumer to one in-flight delivery.

The pack is safe to register before cutover because `enabled` defaults to
`false`. Default reservations are 200 CPU / 512 MiB for the worker (bursting to
1 GiB) and 50 CPU / 64 MiB for its shared Envoy sidecar.

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
updates JetStream resources.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-pdf-worker \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/application-registry-pdf-worker@sha256:<digest>'
```
