# `@cv/schema-editor`

Runtime-schema-driven editing primitives. The package has no dependency on the
CV document or facts contracts.

- `@cv/schema-editor/core` inspects the encoded (JSON/wire) side of an Effect
  Schema, creates a neutral descriptor, formats validation issues as JSON
  Pointers, and provides a raw-JSON fallback contract.
- `@cv/schema-editor/react` renders a controlled recursive editor from that
  descriptor. Unsupported JSON structures are edited as raw JSON instead of
  being guessed at. Encoded values that JSON cannot represent are reported as
  read-only rather than silently coerced.

The concrete application owns its schema and passes it to this package at
runtime. This package does not modify schemas.

Structural unions are rendered only when their branches can be selected
unambiguously by JSON type or a required literal discriminator. Ambiguous
unions fall back to raw JSON. Metadata values such as defaults and examples are
carried across transformations only when they belong to the encoded side.
