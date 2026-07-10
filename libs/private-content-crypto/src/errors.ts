import { Data } from 'effect'

export class PrivateCryptoUnavailableError extends Data.TaggedError(
  'PrivateCryptoUnavailableError'
)<{
  readonly message: string
}> {
  static unavailable(message = 'Web Crypto API is not available') {
    return new PrivateCryptoUnavailableError({ message })
  }
}

export class PrivateCryptoOperationError extends Data.TaggedError(
  'PrivateCryptoOperationError'
)<{
  readonly operation: string
  readonly cause: unknown
}> {
  override get message() {
    return `Crypto operation failed: ${this.operation}`
  }
}

export class PrivateCryptoInvalidBase64UrlError extends Data.TaggedError(
  'PrivateCryptoInvalidBase64UrlError'
)<{
  readonly inputLength: number
}> {
  override get message() {
    return 'Invalid base64url value'
  }
}

export class PrivateCryptoInvalidBase64Error extends Data.TaggedError(
  'PrivateCryptoInvalidBase64Error'
)<{
  readonly inputLength: number
}> {
  override get message() {
    return 'Invalid base64 value'
  }
}

export class PrivateCryptoInvalidKeyError extends Data.TaggedError(
  'PrivateCryptoInvalidKeyError'
)<{
  readonly actualBytes: number
  readonly expectedBytes: number
  readonly label: string
}> {
  override get message() {
    return `${this.label} must contain ${this.expectedBytes} bytes`
  }
}

export class PrivateCryptoPayloadError extends Data.TaggedError(
  'PrivateCryptoPayloadError'
)<{
  readonly reason: string
}> {
  override get message() {
    return `Invalid AES-GCM payload: ${this.reason}`
  }
}

export type PrivateCryptoError =
  | PrivateCryptoUnavailableError
  | PrivateCryptoOperationError
  | PrivateCryptoInvalidBase64UrlError
  | PrivateCryptoInvalidBase64Error
  | PrivateCryptoInvalidKeyError
  | PrivateCryptoPayloadError
