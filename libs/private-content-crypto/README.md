# @cv/private-content-crypto

Effect-native crypto helpers for static private content.

The package is browser and Bun compatible. Payload encryption uses
`globalThis.crypto.subtle`, and random bytes/SHA digests use Effect platform
services.

## Usage

```ts
import {
  deriveProfileContentKey,
  encryptAesGcmPayload,
  parsePrivateContentRootKey,
  PrivateCryptoLayer,
  utf8ToBytes,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'

const program = parsePrivateContentRootKey('base64url:...').pipe(
  Effect.flatMap((rootKey) =>
    deriveProfileContentKey({ profileId: 'profile-id', rootKey })
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

Private content is designed for static hosting where encrypted profile payloads
may be fetched by anyone. This package protects confidentiality and integrity of
encrypted payload bytes against readers who do not have the relevant content
key. AES-GCM authentication detects ciphertext, IV, or associated-data
tampering.

It does not protect plaintext after it is opened in a browser, hide access logs,
protect against compromised host JavaScript, or revoke copied links.

## Payloads

`deriveProfileContentKey()` derives stable 256-bit profile content keys from a
32-byte private content root key with HKDF-SHA-256. Tokens and browser sessions
receive only the derived profile key they need.

`encryptAesGcmPayload()` and `decryptAesGcmPayload()` operate on JSON/runtime
payloads. Private file helpers use the binary container:

```text
PCF2 | 12-byte IV | AES-GCM ciphertext+tag
```

Associated data is authenticated but not encrypted. Callers should pass stable
context strings so ciphertext cannot be replayed into another protocol slot.

## Boundary

This package does not mint private profile tokens or encode audience ids. Those
contracts live in `@cv/private-content-tokens`.

## Verification

```bash
bunx nx run private-content-crypto:typecheck
bunx nx run private-content-crypto:test:unit
```
