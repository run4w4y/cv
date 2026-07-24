import { Effect } from 'effect'
import { difference, uniq } from 'es-toolkit/array'
import type { EvidencePlan, JobAnalysis, SectionBrief } from '../../domain'
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
    const plannedRequirementIds = [
      ...plan.matches.map(({ requirementId }) => requirementId),
      ...plan.uncoveredRequirementIds,
    ]
    const unknownRequirements = difference(
      plannedRequirementIds,
      requirementIds
    )
    const unknownEvidence = difference(
      plan.matches.flatMap(({ evidenceIds: selected }) => selected),
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
    return plan
  })

export const validateSectionBrief = (
  references: ReadonlyArray<EvidenceReference>,
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
    const evidenceIds = [...evidenceIdsForGeneration(references)]
    const unknown = difference(brief.evidenceIds, evidenceIds)
    if (unknown.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced unknown evidence IDs: ${uniq(unknown).join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    const allowedEvidenceIds = plan.matches.flatMap(
      (match) => match.evidenceIds
    )
    const outsidePlan = difference(brief.evidenceIds, allowedEvidenceIds)
    if (outsidePlan.length > 0) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Section ${sectionId} referenced evidence IDs outside the validated evidence plan: ${uniq(outsidePlan).join(', ')}`,
          stage: 'briefs',
        })
      )
    }
    return brief
  })
