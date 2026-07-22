# Application registry events

Versioned domain-event contracts and transport-neutral Effect capabilities for
the application registry. Domain services depend on `RegistryEventPublisher`;
they do not depend on NATS or any other transport.

Production provides the NATS-backed publisher from
`@cv/application-registry-events-nats`. Tests can provide the recording layer,
while migrations and deliberately event-free tools may explicitly provide the
noop layer. There is no implicit publisher default.

## Delivery contract

Domain services publish after their PostgreSQL mutation succeeds. Publishing is
synchronous from the caller's perspective, but it is not part of the database
transaction: a committed mutation can therefore be followed by a NATS failure.
Operations that support idempotent retries reuse a stable event ID, and NATS
JetStream deduplicates those retries within its configured duplicate window.

Consumers must still be idempotent. JetStream delivery is at least once, and a
message is acknowledged only after its side effects succeed. Invalid messages
are terminated, transient failures are negatively acknowledged for retry, and
permanent failures are recorded before acknowledgement where the consumer has a
failure record to maintain.
