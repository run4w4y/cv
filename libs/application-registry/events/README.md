# Application registry events

Versioned publication and PDF-generation event contracts, plus
transport-neutral Effect capabilities for the application registry. Services
depend on `RegistryEventPublisher`; they do not depend on NATS or any other
transport.

Production provides the NATS-backed publisher from
`@cv/application-registry-events-nats`. Tests can provide the recording layer,
while migrations and deliberately event-free tools may explicitly provide the
noop layer. There is no implicit publisher default.

## Delivery contract

Publication-change notifications are best-effort after the PostgreSQL mutation
succeeds. PDF-generation requests are strict: failure to publish fails the
request operation. Neither path is part of the database transaction. Operations
that support idempotent retries reuse a stable event ID, and NATS JetStream
deduplicates those retries within its configured duplicate window.

Consumers must still be idempotent. JetStream delivery is at least once, and a
message is acknowledged only after its side effects succeed. Invalid messages
are terminated, transient failures are negatively acknowledged for retry, and
permanent failures are recorded before acknowledgement where the consumer has a
failure record to maintain.
