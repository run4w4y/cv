import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import { reviewedFactIdsForGeneration } from '../../generation/prompts'
import type { EvidencePlan, JobAnalysis, SectionBrief } from '../../domain'
import { PreparationWorkflowError } from '../../domain'

const duplicateIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

export const validateEvidencePlan = (
  analysis: JobAnalysis,
  catalogue: FactsCatalogueV1,
  plan: EvidencePlan
) =>
  Effect.gen(function* () {
    const requirementIds = new Set(
      analysis.requirements.map((requirement) => requirement.id)
    )
    const factIds = reviewedFactIdsForGeneration(catalogue)
    const plannedRequirementIds = [
      ...plan.matches.map(({ requirementId }) => requirementId),
      ...plan.uncoveredRequirementIds,
    ]
    const unknownRequirements = plannedRequirementIds.filter(
      (id) => !requirementIds.has(id)
    )
    const unknownFacts = plan.matches
      .flatMap(({ factIds: selected }) => selected)
      .filter((id) => !factIds.has(id))

    if (unknownRequirements.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown requirement IDs: ${[
            ...new Set(unknownRequirements),
          ].join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    if (unknownFacts.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Evidence plan referenced unknown fact IDs: ${[
            ...new Set(unknownFacts),
          ].join(', ')}`,
          stage: 'evidence',
        })
      )
    }
    const missingRequirements = [...requirementIds].filter(
      (id) => !plannedRequirementIds.includes(id)
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
    const factIds = reviewedFactIdsForGeneration(catalogue)
    const unknown = brief.factIds.filter((id) => !factIds.has(id))
    if (unknown.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced unknown fact IDs: ${[
            ...new Set(unknown),
          ].join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    const allowedFactIds = new Set(
      plan.matches.flatMap((match) => match.factIds)
    )
    const outsidePlan = brief.factIds.filter((id) => !allowedFactIds.has(id))
    if (outsidePlan.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced fact IDs outside the validated evidence plan: ${[
            ...new Set(outsidePlan),
          ].join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    return brief
  })
