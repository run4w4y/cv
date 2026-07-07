import type { PrivateCryptoError } from '@cv/private-content-crypto'
import { Data } from 'effect'

export class PrivateCapabilityTokenFormatError extends Data.TaggedError(
  'PrivateCapabilityTokenFormatError'
)<{
  readonly message: string
}> {}

export class PrivateAudienceCodecError extends Data.TaggedError(
  'PrivateAudienceCodecError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {}

export type PrivateCapabilityTokenError =
  | PrivateCapabilityTokenFormatError
  | PrivateCryptoError
