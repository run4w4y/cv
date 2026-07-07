import { Effect } from 'effect'
import { PrivateRuntimeManifestError } from '../errors'

export const privateRuntimePayloadCompression = 'gzip' as const

export type PrivateRuntimePayloadCompression =
  typeof privateRuntimePayloadCompression

const compressionError = (operation: string, cause?: unknown) =>
  new PrivateRuntimeManifestError({
    cause,
    message: `Could not ${operation} private runtime payload`,
  })

const transformBytes = (
  bytes: Uint8Array,
  operation: string,
  transform: GenericTransformStream
): Effect.Effect<Uint8Array, PrivateRuntimeManifestError> =>
  Effect.tryPromise({
    try: async () => {
      const source = new Blob([bytes.slice().buffer]).stream()
      const transformed = source.pipeThrough(transform)
      const output = await new Response(transformed).arrayBuffer()

      return new Uint8Array(output)
    },
    catch: (cause) => compressionError(operation, cause),
  })

export const compressPrivateRuntimePayload = (
  bytes: Uint8Array
): Effect.Effect<Uint8Array, PrivateRuntimeManifestError> =>
  typeof CompressionStream === 'undefined'
    ? Effect.fail(compressionError('compress'))
    : transformBytes(bytes, 'compress', new CompressionStream('gzip'))

export const decompressPrivateRuntimePayload = (
  bytes: Uint8Array,
  compression: PrivateRuntimePayloadCompression
): Effect.Effect<Uint8Array, PrivateRuntimeManifestError> =>
  typeof DecompressionStream === 'undefined'
    ? Effect.fail(compressionError('decompress'))
    : transformBytes(bytes, 'decompress', new DecompressionStream(compression))
