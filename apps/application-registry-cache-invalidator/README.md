# Application registry cache invalidator

Consumes `CvPublicationChanged` events from the registry JetStream stream and
purges the complete configured public CV `/c/` prefix from Cloudflare.

The worker is the only registry component that needs a Cloudflare cache-purge
credential. Non-retryable Cloudflare failures are terminated; transient
Cloudflare and transport failures are retried by JetStream.
