# Application registry listing-check runner

This pack owns only the periodic one-shot application job. Shared PostgreSQL,
NATS, Vault, Consul, and Nomad foundations remain in the adjacent infrastructure
repository.

The PostgreSQL and NATS infrastructure modules create distinct
`cv-listing-checker` identities and write their credentials once under
`secret/data/cv-listing-checker`. The job reads those records through its
workload identity.

Render and validate it before deployment:

```sh
nomad-pack render nomad/packs/application-registry-listing-check-runner \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-listing-check-runner@sha256:<digest>'
```

The pack defaults to `enabled = false`. Enable it only after the PostgreSQL
baseline and the `terraform/live/prod/jetstream` topology have
been rehearsed, the Worker listing cron has
been removed, and a manual Nomad child exits successfully. Nomad schedules the
job hourly at minute 17 UTC, prohibits overlap, and does not retry failed
children. The Effect program owns per-item retry scheduling and run
finalization; the container-level 19-minute timeout is the final watchdog.
