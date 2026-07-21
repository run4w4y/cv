import {
  type PdfGenerationRequested,
  PdfGenerationRequestedSchema,
} from '@cv/application-registry-api-contract'
import { Effect, Schema } from 'effect'

import { PdfQueueError } from './model'

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

const codecError = (operation: string, cause: unknown) =>
  new PdfQueueError({
    cause,
    message: `Could not ${operation} the PDF queue message.`,
    operation,
  })

export const encodePdfQueueMessage = (
  request: PdfGenerationRequested
): Effect.Effect<Uint8Array, PdfQueueError> =>
  Schema.encodeEffect(PdfGenerationRequestedSchema)(request).pipe(
    Effect.flatMap((encoded) =>
      Effect.try({
        try: () => textEncoder.encode(JSON.stringify(encoded)),
        catch: (cause) => codecError('encode', cause),
      })
    ),
    Effect.mapError((cause) =>
      Schema.is(PdfQueueError)(cause) ? cause : codecError('encode', cause)
    )
  )

export const decodePdfQueueMessage = (
  bytes: Uint8Array
): Effect.Effect<PdfGenerationRequested, PdfQueueError> =>
  Effect.try({
    try: () => JSON.parse(textDecoder.decode(bytes)) as unknown,
    catch: (cause) => codecError('decode', cause),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(PdfGenerationRequestedSchema)),
    Effect.mapError((cause) =>
      Schema.is(PdfQueueError)(cause) ? cause : codecError('decode', cause)
    )
  )
