import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToUtf8,
  normalizeRedactedSecretBytes,
  normalizeSecretBytes,
  type PrivateCryptoError,
  PrivateCryptoOperationError,
  utf8ToBytes,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'
import type * as Redacted from 'effect/Redacted'
import { PrivateAudienceCodecError } from './errors'

const minimumSecretBytes = 32
const syntheticTagBytes = 16
const minimumAudiencePayloadBytes = syntheticTagBytes + 1
const minimumAudienceIdLength = 23
const domain = 'private-content.audience-id:v1'
const associatedData = utf8ToBytes(`${domain}:aad`)
const privateAudienceIdPattern = /^[A-Za-z0-9_-]+$/u

export type PrivateAudienceCodecKey = {
  readonly secretBytes: Uint8Array
}

export type PrivateAudienceCodecFailure =
  | PrivateAudienceCodecError
  | PrivateCryptoError

const concatBytes = (...parts: readonly Uint8Array[]) => {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0)
  )
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }

  return output
}

const bufferSource = (bytes: Uint8Array) => bytes.slice()

const equalBytes = (left: Uint8Array, right: Uint8Array) => {
  if (left.byteLength !== right.byteLength) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

const cryptoOperation = <Value>(
  operation: string,
  run: (crypto: Crypto) => Promise<Value>
): Effect.Effect<Value, PrivateCryptoOperationError, WebCryptoApi> =>
  WebCryptoApi.pipe(
    Effect.flatMap((crypto) =>
      Effect.tryPromise({
        try: () => run(crypto),
        catch: (cause) =>
          new PrivateCryptoOperationError({
            cause,
            operation,
          }),
      })
    )
  )

const digest = (
  key: PrivateAudienceCodecKey,
  label: string
): Effect.Effect<Uint8Array, PrivateCryptoOperationError, WebCryptoApi> =>
  cryptoOperation('private audience SHA-256', (crypto) =>
    crypto.subtle.digest(
      'SHA-256',
      bufferSource(concatBytes(utf8ToBytes(label), key.secretBytes))
    )
  ).pipe(Effect.map((value) => new Uint8Array(value)))

const importAesKey = (
  key: PrivateAudienceCodecKey,
  keyUsages: KeyUsage[]
): Effect.Effect<CryptoKey, PrivateCryptoOperationError, WebCryptoApi> =>
  digest(key, `${domain}:enc\0`).pipe(
    Effect.flatMap((keyBytes) =>
      cryptoOperation('private audience AES-CTR importKey', (crypto) =>
        crypto.subtle.importKey(
          'raw',
          bufferSource(keyBytes),
          'AES-CTR',
          false,
          keyUsages
        )
      )
    )
  )

const importHmacKey = (
  key: PrivateAudienceCodecKey
): Effect.Effect<CryptoKey, PrivateCryptoOperationError, WebCryptoApi> =>
  cryptoOperation('private audience HMAC importKey', (crypto) =>
    crypto.subtle.importKey(
      'raw',
      bufferSource(key.secretBytes),
      {
        hash: 'SHA-256',
        name: 'HMAC',
      },
      false,
      ['sign']
    )
  )

const audienceTag = (
  key: PrivateAudienceCodecKey,
  plaintext: Uint8Array
): Effect.Effect<Uint8Array, PrivateCryptoOperationError, WebCryptoApi> =>
  Effect.gen(function* () {
    const hmacKey = yield* importHmacKey(key)
    const mac = yield* cryptoOperation(
      'private audience synthetic tag HMAC sign',
      (crypto) =>
        crypto.subtle.sign(
          'HMAC',
          hmacKey,
          bufferSource(
            concatBytes(
              utf8ToBytes(`${domain}:siv\0`),
              associatedData,
              Uint8Array.of(0),
              plaintext
            )
          )
        )
    )

    return new Uint8Array(mac).slice(0, syntheticTagBytes)
  })

const audienceCtrParams = (tag: Uint8Array) => ({
  counter: bufferSource(tag),
  length: 64,
  name: 'AES-CTR',
})

export const looksLikePrivateAudienceId = (audienceId: string) =>
  audienceId.length >= minimumAudienceIdLength &&
  privateAudienceIdPattern.test(audienceId)

export const parsePrivateAudienceCodecKey = (
  secret: string
): Effect.Effect<PrivateAudienceCodecKey, PrivateAudienceCodecFailure> =>
  normalizeSecretBytes(secret).pipe(
    Effect.flatMap((secretBytes) =>
      secretBytes.byteLength >= minimumSecretBytes
        ? Effect.succeed({ secretBytes: secretBytes.slice() })
        : Effect.fail(
            new PrivateAudienceCodecError({
              message: `Private audience key must contain at least ${minimumSecretBytes} bytes`,
            })
          )
    )
  )

export const parseRedactedPrivateAudienceCodecKey = (
  secret: Redacted.Redacted<string>
): Effect.Effect<PrivateAudienceCodecKey, PrivateAudienceCodecFailure> =>
  normalizeRedactedSecretBytes(secret).pipe(
    Effect.flatMap((secretBytes) =>
      secretBytes.byteLength >= minimumSecretBytes
        ? Effect.succeed({ secretBytes: secretBytes.slice() })
        : Effect.fail(
            new PrivateAudienceCodecError({
              message: `Private audience key must contain at least ${minimumSecretBytes} bytes`,
            })
          )
    )
  )

export const encodePrivateAudienceId = ({
  audience,
  key,
}: {
  readonly audience: string
  readonly key: PrivateAudienceCodecKey
}): Effect.Effect<string, PrivateAudienceCodecFailure, WebCryptoApi> =>
  Effect.gen(function* () {
    if (!audience.trim()) {
      return yield* Effect.fail(
        new PrivateAudienceCodecError({
          message: 'Audience is required',
        })
      )
    }

    const plaintext = utf8ToBytes(audience)
    const tag = yield* audienceTag(key, plaintext)
    const cryptoKey = yield* importAesKey(key, ['encrypt'])
    const ciphertext = yield* cryptoOperation(
      'private audience AES-CTR encrypt',
      (crypto) =>
        crypto.subtle.encrypt(
          audienceCtrParams(tag),
          cryptoKey,
          bufferSource(plaintext)
        )
    )

    return base64UrlEncode(concatBytes(tag, new Uint8Array(ciphertext)))
  })

export const decodePrivateAudienceId = ({
  audienceId,
  key,
}: {
  readonly audienceId: string
  readonly key: PrivateAudienceCodecKey
}): Effect.Effect<string, PrivateAudienceCodecFailure, WebCryptoApi> =>
  Effect.gen(function* () {
    const payload = yield* base64UrlDecode(audienceId)

    if (payload.byteLength < minimumAudiencePayloadBytes) {
      return yield* Effect.fail(
        new PrivateAudienceCodecError({
          message: 'Private audience id payload is too short',
        })
      )
    }

    const tag = payload.slice(0, syntheticTagBytes)
    const ciphertext = payload.slice(syntheticTagBytes)
    const cryptoKey = yield* importAesKey(key, ['decrypt'])
    const plaintext = yield* cryptoOperation(
      'private audience AES-CTR decrypt',
      (crypto) =>
        crypto.subtle.decrypt(
          audienceCtrParams(tag),
          cryptoKey,
          bufferSource(ciphertext)
        )
    )
    const plaintextBytes = new Uint8Array(plaintext)
    const canonicalTag = yield* audienceTag(key, plaintextBytes)

    if (!equalBytes(tag, canonicalTag)) {
      return yield* Effect.fail(
        new PrivateAudienceCodecError({
          message: 'Private audience id is not canonical',
        })
      )
    }

    return bytesToUtf8(plaintextBytes)
  })
