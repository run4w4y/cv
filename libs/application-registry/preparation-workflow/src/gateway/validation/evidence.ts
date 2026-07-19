import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import { difference, uniq } from 'es-toolkit/array'
import type { EvidencePlan, JobAnalysis, SectionBrief } from '../../domain'
import { PreparationWorkflowError } from '../../domain'
import { reviewedFactIdsForGeneration } from '../../generation/prompts'

const duplicateIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> =>
  uniq(ids.filter((id, index) => ids.indexOf(id) !== index))

export const validateEvidencePlan = (
  analysis: JobAnalysis,
  catalogue: FactsCatalogueV1,
  plan: EvidencePlan
) =>
  Effect.gen(function* () {
    const requirementIds = analysis.requirements.map(({ id }) => id)
    const factIds = [...reviewedFactIdsForGeneration(catalogue)]
    const plannedRequirementIds = [
      ...plan.matches.map(({ requirementId }) => requirementId),
      ...plan.uncoveredRequirementIds,
    ]
    const unknownRequirements = difference(
      plannedRequirementIds,
      requirementIds
    )
    const unknownFacts = difference(
      plan.matches.flatMap(({ factIds: selected }) => selected),
      factIds
    )

    if (unknownRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown requirement IDs: ${uniq(unknownRequirements).join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    if (unknownFacts.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown fact IDs: ${uniq(unknownFacts).join(', ')}`,
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
    return plan
  })

export const validateSectionBrief = (
  catalogue: FactsCatalogueV1,
  plan: EvidencePlan,
  sectionId: string,
  brief: SectionBrief
) =>
  Effect.gen(function* () {
    if (brief.sectionId !== sectionId) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section brief ${brief.sectionId} did not match requested section ${sectionId}.`,
          stage: 'briefs',
        })
      )
    }
    const factIds = [...reviewedFactIdsForGeneration(catalogue)]
    const unknown = difference(brief.factIds, factIds)
    if (unknown.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced unknown fact IDs: ${uniq(unknown).join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    const allowedFactIds = plan.matches.flatMap((match) => match.factIds)
    const outsidePlan = difference(brief.factIds, allowedFactIds)
    if (outsidePlan.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced fact IDs outside the validated evidence plan: ${uniq(outsidePlan).join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    return brief
  })
