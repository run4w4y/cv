# Application registry NATS events

NATS JetStream transport for application-registry domain events. Production
layers publish to the existing `REGISTRY_EVENTS` stream and bind to existing
durable consumers; they never create, update, or delete JetStream topology.

Production topology is declared in
`terraform/modules/application-registry-jetstream`. Test suites provision
isolated streams and consumers through `@cv/test-infrastructure` before
constructing these layers.
