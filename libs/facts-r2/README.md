# `@cv/facts-r2`

Effect services for the private facts bucket. The package uses the R2 S3 API
through `@distilled.cloud/aws`, so browser reads and publication uploads are
signed directly without a Worker or registry API in the data path.

The object store keeps credentials and transport behind an Effect layer. The
reader validates `current.json`, the release manifest, byte lengths, SHA-256
digests, media types, the requested locale, and the code-owned facts schema.
The publication target writes immutable release objects before atomically
replacing `current.json`.
