export const downloadPdf = ({
  bytes,
  filename,
  mediaType,
}: {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mediaType: string
}) => {
  const blob = new Blob([Uint8Array.from(bytes)], { type: mediaType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
