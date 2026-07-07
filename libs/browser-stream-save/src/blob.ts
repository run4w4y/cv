import { Effect } from 'effect'
import { BrowserStreamSaveError } from './errors'
import type { BrowserStreamSaveOptions } from './types'

const bytesBlobPart = (bytes: Uint8Array): BlobPart => {
  const { buffer, byteLength, byteOffset } = bytes

  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength)
  }

  return new Uint8Array(bytes).buffer
}

export const saveWithFileSaver = (
  bytes: Uint8Array,
  { filename }: BrowserStreamSaveOptions
) =>
  Effect.tryPromise({
    try: async () => {
      const { saveAs } = await import('file-saver')
      saveAs(new Blob([bytesBlobPart(bytes)]), filename)
    },
    catch: (cause) =>
      new BrowserStreamSaveError({
        cause,
        message: 'Could not save file with FileSaver',
        operation: 'file-saver',
      }),
  })
