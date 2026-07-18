const chunkSize = 0x8000

export const encodeUtf8Base64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export const decodeUtf8Base64 = (value: string): string => {
  return new TextDecoder().decode(decodeBase64Bytes(value))
}

export const decodeBase64Bytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export const encodeJsonBase64 = (value: unknown): string =>
  encodeUtf8Base64(JSON.stringify(value))

export const decodeJsonBase64 = (value: string): unknown =>
  JSON.parse(decodeUtf8Base64(value))
