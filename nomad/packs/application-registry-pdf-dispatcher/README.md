# Application registry PDF dispatcher

This CV-owned pack registers the one-shot PostgreSQL outbox publisher. It runs
at most once per minute, forbids overlapping children, and exits non-zero after
recording any publish failures so Nomad exposes a truthful run status.

The job is safe to register before cutover because `enabled` defaults to
`false`. Its Consul identity remains `cv-registry`, reusing the existing NATS
and PostgreSQL intentions, while its Vault paths are job-scoped:

- `secret/data/cv-pdf-dispatcher/postgres-credentials`;
- `secret/data/cv-pdf-dispatcher/nats-credentials`.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-pdf-dispatcher \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-pdf-dispatcher@sha256:<digest>'
```
