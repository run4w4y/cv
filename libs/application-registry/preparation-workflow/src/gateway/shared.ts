import { Effect, Match, Predicate, Schema } from 'effect'
import type { GenerationStageMetadata } from '../domain'
import { PreparationWorkflowError } from '../domain'

export const formatted = (value: unknown, maxCharacters = 120_000): string => {
  const text = JSON.stringify(value, null, 2)
  return text.length <= maxCharacters
    ? text
    : `${text.slice(0, maxCharacters)}\n\n[truncated at ${maxCharacters} characters]`
}

export const messageFromUnknown = (cause: unknown): string =>
  Match.value(cause).pipe(
    Match.when(Predicate.isError, (error) => error.message),
    Match.orElse(String)
  )

export const stageError = (stage: string) =>
  Effect.mapError((cause: unknown) =>
    Match.value(cause).pipe(
      Match.when(Schema.is(PreparationWorkflowError), (error) => error),
      Match.orElse(
        (cause) =>
          new PreparationWorkflowError({
            message: messageFromUnknown(cause),
            stage,
          })
      )
    )
  )

export const generationStageMetadata = (
  stage: string,
  result: {
    readonly executor: string
    readonly usage: {
      readonly inputTokens: number | null
      readonly outputTokens: number | null
      readonly totalTokens: number | null
    }
  }
): GenerationStageMetadata => ({
  executor: result.executor,
  stage,
  usage: result.usage,
})
