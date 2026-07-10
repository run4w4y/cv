# @cv/private-content-tokens

Private audience ids and compact profile capability tokens.

This package owns the URL/token contract used by the static private-content
runtime. A token is a bearer capability for one encrypted profile payload. It is
not a user account credential and it is not a revocable session.

## Capability Tokens

Version 1 tokens are:

```text
base64url(0x01 || 32-byte profile content key)
```

The encoded token has no claims JSON or signature. The first byte is the format
version. The remaining bytes are the derived profile content key. The browser
derives a short selector from that key, loads exactly one private profile chunk
for the current locale, and opens it with the key.

## Audience IDs

Audience labels are human-readable strings at mint time. The package converts
them into deterministic encrypted URL ids:

```text
raw audience label -> compact encrypted audience id -> raw audience label
```

The codec uses `PRIVATE_CONTENT_AUDIENCE_KEY`. The same label and key produce
the same compact value, so Cloudflare can group requests by path. Systems with
the key, such as the analytics connector, can decode the value back to the
original label. Link recipients only see an opaque path segment.

## Security Model

Anyone with the full private URL can open that profile's private payload and
private files for supported locales. Creating another audience URL for an
existing profile only mints another URL. Changing encrypted profile content or
rotating the private content root key requires rebuilding private runtime
chunks.

## Verification

```bash
bunx nx run private-content-tokens:typecheck
bunx nx run private-content-tokens:test:unit
```
