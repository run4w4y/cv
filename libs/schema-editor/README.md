# `@cv/schema-editor`

Runtime-schema-driven editing primitives. The package has no dependency on the
CV document or facts contracts.

- `@cv/schema-editor/core` inspects the encoded (JSON/wire) side of an Effect
  Schema, creates a neutral descriptor, formats validation issues as JSON
  Pointers, and provides a raw-JSON fallback contract.
- `@cv/schema-editor/react` renders a controlled recursive editor from that
  descriptor. Unsupported schema nodes are edited as raw JSON instead of being
  guessed at.

The concrete application owns its schema and passes it to this package at
runtime. This package does not modify schemas.
