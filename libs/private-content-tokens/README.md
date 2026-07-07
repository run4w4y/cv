# private-content-tokens

Private content audience ids and compact profile capability tokens.

This package owns the token contract used by the static private content
runtime. A token is a bearer capability that grants access to one encrypted
profile payload. It is not a session token and it is not a general user account
credential.

## Capability Tokens

Version 1 tokens are:

```text
base64url(0x01 || 32-byte profile content key)
```

The encoded token is 44 characters with no prefix, header, claims JSON, or
signature. The first byte is the token format version (`1`). The remaining 32
bytes are the derived profile content key. The browser derives an 11-character
selector from that key, loads exactly one private profile chunk for the current
locale, then opens it with the content key.

Audience ids are not embedded in the token. The route audience id remains in the
URL path for analytics attribution.

## Audience IDs

Audience labels are supplied as human-readable strings at mint time. The
package converts them into deterministic encrypted URL ids:

```text
raw audience label -> base64url(16-byte synthetic tag || ciphertext) -> raw audience label
```

The codec uses `PRIVATE_CONTENT_AUDIENCE_KEY`. The same label and key always
produce the same compact value, so Cloudflare can group requests by path. The
codec uses a deterministic SIV-style construction: HMAC-SHA256 derives a
synthetic tag over the audience label and AES-CTR encrypts the label under that
tag. The analytics connector can decode the value back to the original label
with the same key. No audience metadata table is required.

The audience id is opaque to link recipients. It is reversible only for systems
that have `PRIVATE_CONTENT_AUDIENCE_KEY`.

## Security Model

The capability token carries the profile content key. Anyone with the link can
open that profile's private payload and private files for supported locales.
The profile selector is derived from the key and is not an extra token field.
Encrypted runtime payloads are emitted as locale/selector chunks rather than a
single browser-loaded manifest. Missing chunks and AES-GCM authentication
failures both reject invalid tokens.

Creating more audiences for an existing profile only mints more URLs. Changing
encrypted profile content or the private content root key still requires
rebuilding the private runtime profile chunks.
