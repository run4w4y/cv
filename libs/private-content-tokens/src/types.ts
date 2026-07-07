import type { ContentEncryptionKey } from '@cv/private-content-crypto'

export type PrivateCapability = {
  profileContentKey: ContentEncryptionKey
  profileSelector: string
}

export type MintPrivateCapabilityTokenOptions = {
  profileContentKey: ContentEncryptionKey
}
