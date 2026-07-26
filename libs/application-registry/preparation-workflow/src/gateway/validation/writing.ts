import type {
  CvDocumentV1,
  CvGenerationGuidanceV1,
} from '@cv/contracts/document'
import { cvGenerationGuidanceTargets } from '@cv/contracts/document'
import { Effect } from 'effect'

import { PreparationWorkflowError } from '../../domain'

export type CvWritingIssue = {
  readonly code:
    | 'cv.writing.company-summary'
    | 'cv.writing.meta-summary'
    | 'cv.writing.summary-length'
    | 'cv.writing.word-limit'
  readonly message: string
  readonly path: ReadonlyArray<string | number>
}

type WritingValue = {
  readonly path: ReadonlyArray<string | number>
  readonly value: string
}

const wordCount = (value: string): number =>
  value
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0).length

const pointerSegments = (pointer: string): ReadonlyArray<string> =>
  pointer.split('/').filter((segment) => segment.length > 0)

const valuesAtPointer = (
  value: unknown,
  segments: ReadonlyArray<string>,
  path: ReadonlyArray<string | number> = []
): ReadonlyArray<WritingValue> => {
  const [segment, ...remaining] = segments
  if (segment === undefined) {
    return typeof value === 'string' ? [{ path, value }] : []
  }
  if (segment === '*') {
    return Array.isArray(value)
      ? value.flatMap((item, index) =>
          valuesAtPointer(item, remaining, [...path, index])
        )
      : []
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    !Object.hasOwn(value, segment)
  ) {
    return []
  }
  return valuesAtPointer(Reflect.get(value, segment), remaining, [
    ...path,
    segment,
  ])
}

const writingValues = (
  document: CvDocumentV1,
  target: CvGenerationGuidanceV1['fields'][number]['target']
): ReadonlyArray<WritingValue> => {
  const definition = cvGenerationGuidanceTargets.find(
    (candidate) => candidate.id === target
  )
  if (definition === undefined) {
    throw new Error(`Missing JSON pointer for CV guidance target ${target}.`)
  }
  return valuesAtPointer(document, pointerSegments(definition.pointer))
}

const normalizedCompany = (company: string | null): string | null => {
  const normalized = company?.trim()
  return normalized === undefined || normalized.length < 3 ? null : normalized
}

export const cvWritingIssues = (
  guidance: CvGenerationGuidanceV1,
  company: string | null,
  document: CvDocumentV1
): ReadonlyArray<CvWritingIssue> => {
  const issues: Array<CvWritingIssue> = []
  for (const field of guidance.fields) {
    if (field.maxWords === undefined) continue
    for (const { path, value } of writingValues(document, field.target)) {
      const actual = wordCount(value)
      if (actual > field.maxWords) {
        issues.push({
          code: 'cv.writing.word-limit',
          message: `${field.target} contains ${actual} words; guidance allows at most ${field.maxWords}`,
          path,
        })
      }
    }
  }

  const summary = document.person.summary
  const summaryWords = wordCount(summary)
  if (summaryWords < 35) {
    issues.push({
      code: 'cv.writing.summary-length',
      message:
        'Professional summary is too slight; use two or three natural sentences with roughly 45–60 words',
      path: ['person', 'summary'],
    })
  }
  if (
    /\b(targeting|applying|application|job posting|posting|requirements?|evidence|proof|matches?|matching|fit for)\b/i.test(
      summary
    )
  ) {
    issues.push({
      code: 'cv.writing.meta-summary',
      message:
        'Professional summary reads like application analysis; state the professional experience directly',
      path: ['person', 'summary'],
    })
  }
  const targetCompany = normalizedCompany(company)
  if (
    targetCompany !== null &&
    summary.toLocaleLowerCase().includes(targetCompany.toLocaleLowerCase())
  ) {
    issues.push({
      code: 'cv.writing.company-summary',
      message:
        'Keep the target company name out of the professional summary; tailor through role terminology and evidence instead',
      path: ['person', 'summary'],
    })
  }
  return issues
}

export const validateCvWriting = (
  guidance: CvGenerationGuidanceV1,
  company: string | null,
  document: CvDocumentV1
): Effect.Effect<void, PreparationWorkflowError> => {
  const issues = cvWritingIssues(guidance, company, document)
  return issues.length === 0
    ? Effect.void
    : Effect.fail(
        new PreparationWorkflowError({
          message: `CV writing does not satisfy the pinned guidance: ${issues
            .map(({ message }) => message)
            .join('; ')}`,
          stage: 'validation',
        })
      )
}
