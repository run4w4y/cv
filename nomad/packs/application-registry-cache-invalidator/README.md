# Application Registry cache invalidator

This pack deploys the durable `registry-cache-invalidator` JetStream consumer.
It translates `CvPublicationChanged` domain events into a purge of the
configured public CV `/c/` prefix. The API does not receive the cache-purge
credential.

The pack defaults to disabled so the stream topology, NATS credential, Vault
runtime secret, and image can be installed before cutover.

Required Vault paths:

- `secret/data/cv-cache-invalidator/nats-credentials`;
- `secret/data/cv-cache-invalidator/runtime`, containing
  `cloudflare_cache_purge_api_token`, `cloudflare_zone_id`, and `cv_web_host`.

Apply `terraform/live/prod/jetstream` and the NATS/Consul infrastructure before
enabling the allocation. For this one operator task, explicitly load
`/cv/cache-invalidation,/cv/deploy` through `.env.local`, then populate the
runtime secret with:

```sh
vault kv put secret/cv-cache-invalidator/runtime \
  cloudflare_cache_purge_api_token="$CLOUDFLARE_CACHE_PURGE_API_TOKEN" \
  cloudflare_zone_id="$CLOUDFLARE_ZONE_ID" \
  cv_web_host="$CV_WEB_HOST"
```

The deployment workflow passes `enabled=false` unless the repository variable
`CV_CACHE_INVALIDATOR_ENABLED` is exactly `true`. Set that variable only after
the consumer, NATS credential, Consul intention, runtime secret, and first image
are present.
