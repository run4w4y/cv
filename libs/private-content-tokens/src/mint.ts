import {
  base64UrlEncode,
  contentEncryptionKeyBytes,
} from '@cv/private-content-crypto'
import { Effect } from 'effect'
import { PRIVATE_CAPABILITY_TOKEN_VERSION } from './constants'
import type { MintPrivateCapabilityTokenOptions } from './types'

export const mintPrivateCapabilityToken = ({
  profileContentKey,
}: MintPrivateCapabilityTokenOptions): Effect.Effect<string> =>
  Effect.sync(() => {
    const keyBytes = contentEncryptionKeyBytes(profileContentKey)
    const tokenBytes = new Uint8Array(keyBytes.byteLength + 1)
    tokenBytes[0] = PRIVATE_CAPABILITY_TOKEN_VERSION
    tokenBytes.set(keyBytes, 1)

    return base64UrlEncode(tokenBytes)
  })
