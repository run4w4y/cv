import { decodeBase64Bytes } from '../../base64'

export const downloadBase64Pdf = ({
  data,
  filename,
  mediaType,
}: {
  readonly data: string
  readonly filename: string
  readonly mediaType: string
}) => {
  const blob = new Blob([decodeBase64Bytes(data)], { type: mediaType })
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
