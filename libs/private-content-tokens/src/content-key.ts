import {
  encodeContentEncryptionKeySecret,
  generateContentEncryptionKey,
  type PrivateCryptoError,
} from '@cv/private-content-crypto'
import { Effect, type Crypto as EffectCrypto } from 'effect'

export const generatePrivateContentKey = (): Effect.Effect<
  string,
  PrivateCryptoError,
  EffectCrypto.Crypto
> =>
  generateContentEncryptionKey().pipe(
    Effect.map(encodeContentEncryptionKeySecret)
  )
