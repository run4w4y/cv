# private-content-crypto

Effect-native crypto helpers for private content encryption. The package is
browser and Bun compatible: payload encryption uses `globalThis.crypto.subtle`,
and random bytes/SHA digests use Effect's platform `Crypto` service.

The public API returns `Effect.Effect` for operations that can fail or touch
crypto. Operations that need raw `SubtleCrypto` require the `WebCryptoApi`
service. Browser entry points should provide `PrivateCryptoLayer`; Bun and Node
entry points that already provide platform services can provide
`WebCryptoApiLayer` only for raw WebCrypto operations.

```ts
import { Effect } from 'effect'
import {
  deriveProfileContentKey,
  encryptAesGcmPayload,
  parsePrivateContentRootKey,
  utf8ToBytes,
  PrivateCryptoLayer,
} from '@cv/private-content-crypto'

const program = parsePrivateContentRootKey('base64url:...').pipe(
  Effect.flatMap((rootKey) =>
    deriveProfileContentKey({ profileId: 'p_frontend', rootKey })
  ),
  Effect.flatMap((key) =>
    encryptAesGcmPayload(key, utf8ToBytes('private payload'))
  )
)

const payload = await Effect.runPromise(
  program.pipe(Effect.provide(PrivateCryptoLayer))
)
```

For Promise-only integration points, use `runPrivateCryptoPromise(effect)`,
which provides `PrivateCryptoLayer` internally.

## Threat Model

The private content data is designed for static hosting where encrypted profile
payloads may be fetched by anyone. This package protects the confidentiality and
integrity of encrypted payload bytes against readers who do not have the
relevant content keys. AES-GCM authentication also detects ciphertext, IV, or
associated data tampering.

It does not protect plaintext after it is opened in a browser, hide access logs,
prevent a compromised host from serving malicious JavaScript, or revoke a token
that has already been copied.

## AES-GCM Payloads

`deriveProfileContentKey()` derives stable 256-bit profile content keys from a
private content root key with HKDF-SHA-256. The root key remains build/operator
secret material; tokens and browser sessions only receive the derived profile
key they need.

`encryptAesGcmPayload()` imports a validated 32-byte content encryption key,
generates a 96-bit IV with Effect's platform `Crypto` service, and returns
base64url-encoded `iv` and `ciphertext`. `decryptAesGcmPayload()` authenticates
the same payload before returning plaintext bytes.

Associated data is not encrypted, but it is authenticated. Callers should pass
stable context strings as UTF-8 bytes so ciphertext cannot be replayed into a
different protocol slot.

## Private File Payloads

`encryptPrivateFilePayload()` and `decryptPrivateFilePayload()` use the same
AES-GCM primitive for private file bytes. The binary file container is:

```text
PCF2 | 12-byte IV | AES-GCM ciphertext+tag
```

Malformed containers fail with `PrivateCryptoPayloadError`. Generated private
files must be rebuilt with the current code.

## Source Layout

- `content-key.ts`: validated 256-bit content keys and secret parsing.
- `root-key.ts`: validated 256-bit private content root keys and profile key
  derivation.
- `aes-gcm/`: shared AES-GCM bytes, JSON payload, and private file payload
  encryption/decryption.
- `bytes.ts` and `encoding.ts`: internal byte helpers and public encoding
  helpers.
- `web-crypto.ts`: raw WebCrypto service and browser platform `Crypto` adapter.

## Package Boundary

This package intentionally does not mint or decode private profile tokens.
Compact bearer capability tokens live in `@cv/private-content-tokens`, which
builds on these primitives.
