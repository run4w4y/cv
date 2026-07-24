export const binaryBlob = ({
  bytes,
  mediaType,
}: {
  readonly bytes: Uint8Array
  readonly mediaType: string
}) => new Blob([Uint8Array.from(bytes)], { type: mediaType })

export const downloadBytes = ({
  bytes,
  filename,
  mediaType,
}: {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mediaType: string
}) => {
  const objectUrl = URL.createObjectURL(binaryBlob({ bytes, mediaType }))
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
