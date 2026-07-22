# Test infrastructure

Private, platform-neutral Testcontainers lifecycle helpers shared by integration
tests in this workspace. The package owns container startup, readiness,
connection coordinates, and cleanup; schemas, fixtures, stream names, buckets,
and application processes remain owned by the consuming test suite.

Each Nx integration target starts only the isolated containers it requires.
Running containers are not shared across targets or CI jobs.
