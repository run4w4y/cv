export const toBufferSource = (bytes: Uint8Array) => bytes.slice()

export const toOptionalBufferSource = (bytes: Uint8Array | undefined) =>
  bytes ? toBufferSource(bytes) : undefined

export const concatBytes = (...parts: Uint8Array[]) => {
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }

  return output
}
