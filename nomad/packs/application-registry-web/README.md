# Application Registry web

This pack deploys the management SPA in an unprivileged Nginx allocation. It
owns the `cv-registry` Traefik hostname and serves only static application
assets. It has no registry API upstream and therefore needs no Envoy sidecar.

Cloudflare Access protects this hostname. The browser separately asks the user
for an API origin and bearer token, then calls `cv-api` directly through the
API's CORS boundary.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-web \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-application-registry-web@sha256:<digest>'
```
