import type { CursorCodec, CursorPayload } from './types'

const encodeBytes = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

const decodeBytes = (token: string): Uint8Array => {
  if (
    token.length === 0 ||
    token.length % 4 === 1 ||
    !/^[A-Za-z0-9_-]+$/u.test(token)
  ) {
    throw new TypeError('The token is not valid unpadded base64url.')
  }

  const paddingLength = (4 - (token.length % 4)) % 4
  const base64 = `${token.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat(
    paddingLength
  )}`
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  if (encodeBytes(bytes) !== token) {
    throw new TypeError('The token is not valid unpadded base64url.')
  }

  return bytes
}

/**
 * Base64url JSON cursor codec used when a query definition does not provide a
 * signing or encryption codec.
 */
export const defaultCursorCodec: CursorCodec = {
  encode: (payload: CursorPayload) => {
    const json = JSON.stringify(payload)
    return encodeBytes(new TextEncoder().encode(json))
  },
  decode: (token: string) => {
    const bytes = decodeBytes(token)
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return JSON.parse(json) as unknown
  },
}
