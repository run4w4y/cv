import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type {
  CvAuthoringItem,
  CvAuthoringPlan,
  EvidencePlan,
} from '../../domain'
import { PreparationWorkflowError } from '../../domain'
import {
  type CvAuthoringSource,
  cvAuthoringSourceForGeneration,
} from '../../generation'

type SectionBudget = {
  readonly maximumItems: number
  readonly minimumItems: number
  readonly targetItems: number
}

export type CvAuthoringPolicy = {
  readonly budgets: {
    readonly experience: SectionBudget
    readonly projects: SectionBudget
  }
  readonly experience: ReadonlyArray<{
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
  }>
  readonly projects: ReadonlyArray<{
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
  }>
}

export type CvAuthoringIssue = {
  readonly message: string
  readonly path: ReadonlyArray<string | number>
}

const experienceBudget = (availableItems: number): SectionBudget => ({
  maximumItems: Math.min(5, availableItems),
  minimumItems: Math.min(3, availableItems),
  targetItems: Math.min(4, availableItems),
})

const projectBudget = (availableItems: number): SectionBudget => ({
  maximumItems: Math.min(3, availableItems),
  minimumItems: availableItems === 0 ? 0 : 1,
  targetItems: Math.min(2, availableItems),
})

export const cvAuthoringPolicyForGeneration = (
  source: CvAuthoringSource
): CvAuthoringPolicy => ({
  budgets: {
    experience: experienceBudget(source.experience.length),
    projects: projectBudget(source.projects.length),
  },
  experience: source.experience.map(({ evidenceIds, id }) => ({
    evidenceIds,
    id,
  })),
  projects: source.projects.map(({ evidenceIds, id }) => ({
    evidenceIds,
    id,
  })),
})

const selectedEvidenceIds = (plan: EvidencePlan): ReadonlySet<string> =>
  new Set(plan.requirements.flatMap(({ evidenceIds }) => evidenceIds))

const itemIssues = (
  section: 'education' | 'experience' | 'projects' | 'skillGroups',
  selected: ReadonlyArray<CvAuthoringItem>,
  available: ReadonlyArray<{
    readonly evidenceIds: ReadonlyArray<string>
    readonly id: string
  }>,
  roleEvidenceIds: ReadonlySet<string>,
  budget?: SectionBudget
): ReadonlyArray<CvAuthoringIssue> => {
  const issues: Array<CvAuthoringIssue> = []
  const availableById = new Map(available.map((item) => [item.id, item]))
  const seen = new Set<string>()

  if (budget !== undefined && selected.length < budget.minimumItems) {
    issues.push({
      message: `${section} must include at least ${budget.minimumItems} items; received ${selected.length}`,
      path: [section],
    })
  }
  if (budget !== undefined && selected.length > budget.maximumItems) {
    issues.push({
      message: `${section} may include at most ${budget.maximumItems} items; received ${selected.length}`,
      path: [section],
    })
  }

  selected.forEach((item, itemIndex) => {
    if (seen.has(item.id)) {
      issues.push({
        message: `${section} contains duplicate ID ${item.id}`,
        path: [section, itemIndex, 'id'],
      })
    }
    seen.add(item.id)

    const candidate = availableById.get(item.id)
    if (candidate === undefined) {
      issues.push({
        message: `${section}:${item.id} is not available in reviewed facts`,
        path: [section, itemIndex, 'id'],
      })
      return
    }

    const ownedEvidenceIds = new Set(candidate.evidenceIds)
    item.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      if (!ownedEvidenceIds.has(evidenceId)) {
        issues.push({
          message: `${section}:${item.id} does not own evidence ${evidenceId}`,
          path: [section, itemIndex, 'evidenceIds', evidenceIndex],
        })
      } else if (!roleEvidenceIds.has(evidenceId)) {
        issues.push({
          message: `${section}:${item.id} uses evidence not selected for this role: ${evidenceId}`,
          path: [section, itemIndex, 'evidenceIds', evidenceIndex],
        })
      }
    })

    const relevantCandidateEvidenceIds = candidate.evidenceIds.filter(
      (evidenceId) => roleEvidenceIds.has(evidenceId)
    )
    if (
      relevantCandidateEvidenceIds.length > 0 &&
      !item.evidenceIds.some((evidenceId) => roleEvidenceIds.has(evidenceId))
    ) {
      issues.push({
        message: `${section}:${item.id} omitted its selected role evidence`,
        path: [section, itemIndex, 'evidenceIds'],
      })
    }
  })
  return issues
}

export const cvAuthoringPlanIssues = (
  source: CvAuthoringSource,
  evidencePlan: EvidencePlan,
  plan: CvAuthoringPlan
): ReadonlyArray<CvAuthoringIssue> => {
  const roleEvidenceIds = selectedEvidenceIds(evidencePlan)
  const policy = cvAuthoringPolicyForGeneration(source)
  const referenceById = new Map(
    source.references.map((reference) => [reference.id, reference])
  )
  const availableAdditionalIds = new Set(
    source.additionalSectionItems.map(({ id }) => id)
  )
  const issues: Array<CvAuthoringIssue> = [
    ...itemIssues(
      'experience',
      plan.experience,
      source.experience,
      roleEvidenceIds,
      policy.budgets.experience
    ),
    ...itemIssues(
      'projects',
      plan.projects,
      source.projects,
      roleEvidenceIds,
      policy.budgets.projects
    ),
    ...itemIssues(
      'skillGroups',
      plan.skillGroups,
      source.skillGroups,
      roleEvidenceIds
    ),
    ...itemIssues(
      'education',
      plan.education,
      source.education,
      roleEvidenceIds
    ),
  ]

  if (
    policy.budgets.experience.minimumItems >= 3 &&
    plan.projects.length >= plan.experience.length
  ) {
    issues.push({
      message:
        'projects must remain a supporting section with fewer items than experience',
      path: ['projects'],
    })
  }

  plan.profileEvidenceIds.forEach((evidenceId, index) => {
    if (!referenceById.has(evidenceId)) {
      issues.push({
        message: `Profile references unknown evidence ${evidenceId}`,
        path: ['profileEvidenceIds', index],
      })
    } else if (!roleEvidenceIds.has(evidenceId)) {
      issues.push({
        message: `Profile uses evidence not selected for this role: ${evidenceId}`,
        path: ['profileEvidenceIds', index],
      })
    }
  })

  plan.skillGroups.forEach((group, groupIndex) => {
    group.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      if (referenceById.get(evidenceId)?.kind !== 'skill') {
        issues.push({
          message: `Skill groups must cite reviewed skill evidence, received ${evidenceId}`,
          path: ['skillGroups', groupIndex, 'evidenceIds', evidenceIndex],
        })
      }
    })
  })

  plan.additionalEvidenceIds.forEach((evidenceId, index) => {
    if (!availableAdditionalIds.has(evidenceId)) {
      issues.push({
        message: `Additional sections reference unavailable evidence ${evidenceId}`,
        path: ['additionalEvidenceIds', index],
      })
    } else if (!roleEvidenceIds.has(evidenceId)) {
      issues.push({
        message: `Additional sections use evidence not selected for this role: ${evidenceId}`,
        path: ['additionalEvidenceIds', index],
      })
    }
  })

  return issues
}

const exactIdIssues = (
  section: 'education' | 'experience' | 'projects' | 'skills',
  expected: ReadonlyArray<{ readonly id: string }>,
  actual: ReadonlyArray<{ readonly id: string }>
): ReadonlyArray<CvAuthoringIssue> => {
  const expectedIds = expected.map(({ id }) => id)
  const actualIds = actual.map(({ id }) => id)
  return expectedIds.length === actualIds.length &&
    expectedIds.every((id, index) => actualIds[index] === id)
    ? []
    : [
        {
          message: `${section} IDs and order must match the authoring plan`,
          path: [section],
        },
      ]
}

export const cvDocumentAuthoringIssues = (
  source: CvAuthoringSource,
  plan: CvAuthoringPlan,
  document: CvDocumentV1,
  educationDatesRequired: boolean
): ReadonlyArray<CvAuthoringIssue> => {
  const referenceById = new Map(
    source.references.map((reference) => [reference.id, reference])
  )
  const actualAdditionalIds = document.additionalSections.flatMap(({ items }) =>
    items.map(({ id }) => id)
  )
  const issues: Array<CvAuthoringIssue> = [
    ...exactIdIssues('experience', plan.experience, document.experience),
    ...exactIdIssues('projects', plan.projects, document.projects),
    ...exactIdIssues('skills', plan.skillGroups, document.skills),
    ...exactIdIssues('education', plan.education, document.education),
  ]

  plan.skillGroups.forEach((planned, index) => {
    const actual = document.skills[index]
    if (actual === undefined) return
    const expectedItems = planned.evidenceIds.flatMap((evidenceId) => {
      const reference = referenceById.get(evidenceId)
      return reference?.kind === 'skill' ? [reference.label] : []
    })
    if (
      expectedItems.length !== actual.items.length ||
      !expectedItems.every(
        (item, itemIndex) => actual.items[itemIndex] === item
      )
    ) {
      issues.push({
        message: `skills:${planned.id} items must match its reviewed skill evidence`,
        path: ['skills', index, 'items'],
      })
    }
  })

  document.education.forEach((item, index) => {
    if ((item.period !== undefined) !== educationDatesRequired) {
      issues.push({
        message: educationDatesRequired
          ? `education:${item.id} must include its reviewed period because the posting explicitly requires education dates`
          : `education:${item.id} must omit its period by default`,
        path: ['education', index, 'period'],
      })
    }
  })

  if (
    plan.additionalEvidenceIds.length !== actualAdditionalIds.length ||
    !plan.additionalEvidenceIds.every(
      (id, index) => actualAdditionalIds[index] === id
    )
  ) {
    issues.push({
      message:
        'Additional-section item IDs and order must match the authoring plan',
      path: ['additionalSections'],
    })
  }
  return issues
}

const invalidAuthoring = (
  label: string,
  issues: ReadonlyArray<CvAuthoringIssue>
) =>
  new PreparationWorkflowError({
    message: `${label}: ${issues.map(({ message }) => message).join('; ')}`,
    stage: 'validation',
  })

export const validateCvAuthoringPlan = (
  catalogue: FactsCatalogueV1,
  evidencePlan: EvidencePlan,
  plan: CvAuthoringPlan
): Effect.Effect<CvAuthoringPlan, PreparationWorkflowError> => {
  const issues = cvAuthoringPlanIssues(
    cvAuthoringSourceForGeneration(catalogue),
    evidencePlan,
    plan
  )
  return issues.length === 0
    ? Effect.succeed(plan)
    : Effect.fail(invalidAuthoring('CV authoring plan is invalid', issues))
}

export const validateCvDocumentAuthoring = (
  catalogue: FactsCatalogueV1,
  plan: CvAuthoringPlan,
  document: CvDocumentV1,
  educationDatesRequired: boolean
): Effect.Effect<void, PreparationWorkflowError> => {
  const issues = cvDocumentAuthoringIssues(
    cvAuthoringSourceForGeneration(catalogue),
    plan,
    document,
    educationDatesRequired
  )
  return issues.length === 0
    ? Effect.void
    : Effect.fail(
        invalidAuthoring('CV does not match its authoring plan', issues)
      )
}
