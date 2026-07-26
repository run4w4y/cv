import { Effect } from 'effect'
import { difference, uniq } from 'es-toolkit/array'
import type { EvidencePlan, JobAnalysis } from '../../domain'
import { PreparationWorkflowError } from '../../domain'
import type { EvidenceReference } from '../../generation/prompts'
import { evidenceIdsForGeneration } from '../../generation/prompts'

const duplicateIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> =>
  uniq(ids.filter((id, index) => ids.indexOf(id) !== index))

export const validateEvidencePlan = (
  analysis: JobAnalysis,
  references: ReadonlyArray<EvidenceReference>,
  plan: EvidencePlan
) =>
  Effect.gen(function* () {
    const requirementIds = analysis.requirements.map(({ id }) => id)
    const evidenceIds = [...evidenceIdsForGeneration(references)]
    const plannedRequirementIds = plan.requirements.map(
      ({ requirementId }) => requirementId
    )
    const unknownRequirements = difference(
      plannedRequirementIds,
      requirementIds
    )
    const unknownEvidence = difference(
      plan.requirements.flatMap(({ evidenceIds: selected }) => selected),
      evidenceIds
    )

    if (unknownRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown requirement IDs: ${uniq(unknownRequirements).join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    if (unknownEvidence.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown evidence IDs: ${uniq(unknownEvidence).join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const missingRequirements = difference(
      requirementIds,
      plannedRequirementIds
    )
    if (missingRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan omitted requirement IDs: ${missingRequirements.join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const duplicateRequirements = duplicateIds(plannedRequirementIds)
    if (duplicateRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan covered requirement IDs more than once: ${duplicateRequirements.join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    if (
      !requirementIds.every(
        (requirementId, index) => plannedRequirementIds[index] === requirementId
      )
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message:
            'Evidence plan requirement order must match the job analysis.',
          stage: 'evidence',
        })
      )
    }
    return plan
  })
