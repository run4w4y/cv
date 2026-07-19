import { Cause, Effect } from 'effect'
import type { AiStageMetadata } from '../domain'
import { PreparationWorkflowError } from '../domain'

export const formatted = (value: unknown, maxCharacters = 120_000): string => {
  const text = JSON.stringify(value, null, 2)
  return text.length <= maxCharacters
    ? text
    : `${text.slice(0, maxCharacters)}\n\n[truncated at ${maxCharacters} characters]`
}

export const messageFromUnknown = (cause: unknown): string =>
  Cause.prettyErrors(Cause.fail(cause))[0]?.message ?? String(cause)

export const stageError = (stage: string) =>
  Effect.mapError((cause: unknown) =>
    cause instanceof PreparationWorkflowError
      ? cause
      : new PreparationWorkflowError({
          message: messageFromUnknown(cause),
          stage,
        })
  )

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
