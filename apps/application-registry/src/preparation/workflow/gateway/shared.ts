import type { AiJsonSchema } from '@cv/ai-provider'
import { Effect, Schema } from 'effect'

import { decodeJsonBase64, decodeUtf8Base64 } from '../../base64'
import type { AiStageMetadata } from '../domain'
import { PreparationWorkflowError } from '../domain'

export const formatted = (value: unknown, maxCharacters = 120_000): string => {
  const text = JSON.stringify(value, null, 2)
  return text.length <= maxCharacters
    ? text
    : `${text.slice(0, maxCharacters)}\n\n[truncated at ${maxCharacters} characters]`
}

export const jsonSchemaFor = (schema: Schema.Top): AiJsonSchema => {
  const standard = Schema.toStandardJSONSchemaV1(schema)
  // The AI SDK still declares Draft 7 while Effect returns the standard JSON
  // Schema record. Provider output is decoded through the Effect schema again.
  return standard['~standard'].jsonSchema.input({
    target: 'draft-07',
  }) as AiJsonSchema
}

export const messageFromUnknown = (cause: unknown): string => {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return cause.message
  }
  return String(cause)
}

export const stageError = (stage: string) =>
  Effect.mapError(
    (cause: unknown) =>
      new PreparationWorkflowError({
        message: messageFromUnknown(cause),
        stage,
      })
  )

export const decodeOpaqueValue = (
  stage: string,
  payload: {
    readonly data: string
    readonly mediaType: string
  }
): Effect.Effect<unknown, PreparationWorkflowError> =>
  Effect.try({
    try: () =>
      payload.mediaType.includes('json')
        ? decodeJsonBase64(payload.data)
        : decodeUtf8Base64(payload.data),
    catch: (cause) =>
      new PreparationWorkflowError({
        message: `The registry returned a malformed opaque payload: ${messageFromUnknown(cause)}`,
        stage,
      }),
  })

export const asJson = (stage: string, value: unknown) =>
  Schema.decodeUnknownEffect(Schema.Json)(value).pipe(stageError(stage))

export const aiStageMetadata = (
  stage: string,
  result: {
    readonly finishReason: string
    readonly modelId: string
    readonly usage: {
      readonly inputTokens: number | null
      readonly outputTokens: number | null
      readonly totalTokens: number | null
    }
  }
): AiStageMetadata => ({
  finishReason: result.finishReason,
  modelId: result.modelId,
  stage,
  usage: result.usage,
})
