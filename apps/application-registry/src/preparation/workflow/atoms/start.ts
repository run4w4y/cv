import { ApplicationPreparation } from '@cv/application-preparation-workflow'
import type {
  CreateAiWorkflowBatchInput,
  CreateAiWorkflowJobInput,
} from '@cv/application-preparation-workflow/domain'
import { Effect } from 'effect'

import { preparationRuntime } from './runtime'

const createJob = Effect.fn('PreparationAtom.createJob')(function* (
  input: CreateAiWorkflowJobInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.createJob(input)
})

const createBatch = Effect.fn('PreparationAtom.createBatch')(function* (
  input: CreateAiWorkflowBatchInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.createBatch(input)
})

const retryJob = Effect.fn('PreparationAtom.retryJob')(function* (
  jobId: string
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.retryJob(jobId)
})

export const createAiWorkflowJobAtom =
  preparationRuntime.fn<CreateAiWorkflowJobInput>()(createJob, {
    concurrent: true,
  })

export const createAiWorkflowBatchAtom =
  preparationRuntime.fn<CreateAiWorkflowBatchInput>()(createBatch, {
    concurrent: true,
  })

export const retryAiWorkflowJobAtom = preparationRuntime.fn<string>()(
  retryJob,
  { concurrent: true }
)
