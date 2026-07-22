import { Effect, Layer } from 'effect'

import {
  StructuredGeneration,
  StructuredGenerationError,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
  type StructuredGenerationShape,
} from '../generation/service'

export type StructuredGenerationTestOptions = {
  readonly generate?: (
    request: StructuredGenerationRequest
  ) => Effect.Effect<StructuredGenerationResult, StructuredGenerationError>
}

export type StructuredGenerationTestHarness = {
  readonly layer: Layer.Layer<StructuredGeneration>
  readonly requests: ReadonlyArray<StructuredGenerationRequest>
}

const unimplemented = Effect.fn('StructuredGeneration.Test.unimplemented')(
  function* () {
    return yield* Effect.fail(
      new StructuredGenerationError({
        cause: null,
        kind: 'failed',
        message: 'No structured-generation test response was configured.',
        retryAfterSeconds: null,
      })
    )
  }
)

export const makeStructuredGenerationTestLayer = (
  options: StructuredGenerationTestOptions = {}
): StructuredGenerationTestHarness => {
  const requests: Array<StructuredGenerationRequest> = []
  const generate = options.generate ?? unimplemented
  const service: StructuredGenerationShape = {
    generate: Effect.fn('StructuredGeneration.Test.generate')(
      function* (request) {
        requests.push(request)
        return yield* generate(request)
      }
    ),
  }

  return {
    layer: Layer.succeed(StructuredGeneration, service),
    requests,
  }
}
