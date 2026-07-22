# `@cv/facts-reader`

Verified, read-only access to the active private facts release.

The management app uses the HTTP object-store adapter through its authenticated
same-origin registry proxy. The reader validates `current.json`, the v2
manifest, byte lengths, SHA-256 digests, media types, locale, generation
guidance, and code-owned schemas. This package contains no S3 client and no
write operation; publication belongs exclusively to the registry API.
