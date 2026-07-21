# CV PDF runner

This CV-owned pack deploys one Playwright process backed by the durable
`cv-pdf` JetStream pull consumer. The process reuses one Chromium instance but
opens a fresh page for each job. `max_ack_pending=1` keeps browser concurrency
at one even if another allocation is accidentally started.

The pack is safe to register before cutover because `enabled` defaults to
`false`. Default reservations are intentionally conservative for the current
single-node cluster: 200 CPU / 512 MiB for the runner (bursting to 1 GiB) and
50 CPU / 64 MiB for its one shared Envoy sidecar.

Required Vault paths are:

- `secret/data/cv-pdf/postgres-credentials`;
- `secret/data/cv-pdf/minio-credentials`;
- `secret/data/cv-pdf/nats-credentials`.

Render before registering:

```sh
nomad-pack render nomad/packs/cv-pdf-runner \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-pdf-runner@sha256:<digest>'
```
