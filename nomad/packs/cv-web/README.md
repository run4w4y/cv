# CV web

This pack deploys the public CV as a standalone Next.js service. Traefik exposes
the `cv` hostname through the existing Cloudflare Tunnel, and the service reads
publications from the private `cv-registry` service through a single Consul
Connect upstream.

Terraform owns the edge-only Cloudflare cache policy for public CV pages.
Preview and internal routes are private and `no-store`. The dedicated registry
cache invalidator consumes publication events and purges the public `/c/`
prefix.

Render before registering:

```sh
nomad-pack render nomad/packs/cv-web \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-web@sha256:<digest>' \
  --var 'deployment_id=<git-sha>'
```
