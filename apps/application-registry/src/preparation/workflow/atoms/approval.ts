import { ApplicationPreparation } from '@cv/application-preparation-workflow'
import type { ApproveArtifactInput } from '@cv/application-preparation-workflow/domain'
import { Effect } from 'effect'

import { preparationRuntime } from './runtime'

export type { ApproveArtifactInput }

const approveArtifact = Effect.fn('PreparationAtom.approveArtifact')(function* (
  input: ApproveArtifactInput
) {
  const preparation = yield* ApplicationPreparation
  return yield* preparation.approveArtifact(input)
})

export const approveArtifactAtom =
  preparationRuntime.fn<ApproveArtifactInput>()(approveArtifact, {
    concurrent: true,
  })
