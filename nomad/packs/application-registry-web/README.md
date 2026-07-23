# Application Registry web

This pack deploys the management SPA in an unprivileged Nginx allocation. It
owns the public `registry-origin` Traefik hostname and proxies registry API,
machine transport, public CV resolver, health, and OpenAPI paths to the private
`cv-registry` service over Consul Connect.

The browser keeps using same-origin requests and never receives the registry
bearer token. Cloudflare Access remains the external authorization boundary;
the API performs its existing BFF token injection after the request reaches the
private service.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-web \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-application-registry-web@sha256:<digest>'
```
