import {
  StructuredGeneration,
  validateCvProvenance,
} from '@cv/application-preparation-workflow'
import {
  CoverLetterDocumentSchema,
  coverLetterContractId,
  coverLetterContractVersion,
  coverLetterJsonSchema,
} from '@cv/application-preparation-workflow/cover-letter'
import { cvDocumentV1JsonSchema } from '@cv/application-preparation-workflow/cv'
import type { ContentEntry } from '@cv/application-registry-entity'
import {
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect, Schema } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'

import {
  contentMutationReactivityKeys,
  publicationMutationReactivityKeys,
} from './keys'
import { PreparationRepository } from './repository'
import { preparationDataRuntime } from './runtime'
import { PreparationDataError, type SavedContentRevision } from './types'

export type RefinePreparationRevisionInput = {
  readonly applicationId: string
  readonly currentDocument: unknown
  readonly entry: ContentEntry
  readonly factsCatalogue: FactsCatalogueV1
  readonly factsReleaseId: string
  readonly instruction: string
  readonly jobContext: Schema.Json
  readonly jobSnapshotId: string
  readonly operationId: string
}

const formatted = (value: unknown): string => {
  const text = JSON.stringify(value, null, 2)
  return text.length <= 120_000
    ? text
    : `${text.slice(0, 120_000)}\n\n[truncated]`
}

const refinementFailure = (
  operation: string,
  cause: unknown
): PreparationDataError =>
  new PreparationDataError({
    message: String(cause),
    operation,
  })

const refinementInstructions = (kind: ContentEntry['kind']): string =>
  kind === 'cv'
    ? 'Refine an existing CV document. Return the complete updated document, preserve its schema and locale, and use only reviewed fact IDs and claims from the supplied facts catalogue. Make only changes relevant to the user instruction.'
    : 'Refine an existing cover letter. Return the complete updated document, preserve its schema and locale, and use the reviewed facts catalogue as the sole source of personal claims. Keep it consistent with the supplied tailored CV when one is present.'

export const refinePreparationRevision = Effect.fn(
  'PreparationRepository.refineRevision'
)(function* (input: RefinePreparationRevisionInput) {
  const instruction = input.instruction.trim()
  if (instruction.length === 0) {
    return yield* Effect.fail(
      refinementFailure(
        'refine-content-revision',
        'Enter a refinement request.'
      )
    )
  }

  const repository = yield* PreparationRepository
  const generation = yield* StructuredGeneration
  const referenceCv =
    input.entry.kind === 'cover_letter'
      ? yield* repository.loadPreparationHead({
          applicationId: input.applicationId,
          kind: 'cv',
          locale: input.entry.locale,
        })
      : null
  const outputSchema =
    input.entry.kind === 'cv' ? cvDocumentV1JsonSchema : coverLetterJsonSchema
  const generated = yield* generation.generate({
    instructions: refinementInstructions(input.entry.kind),
    outputSchema,
    prompt: [
      'User refinement request:',
      instruction,
      'Current document:',
      formatted(input.currentDocument),
      'Captured job posting:',
      formatted(input.jobContext),
      'Trusted reviewed facts catalogue:',
      formatted(input.factsCatalogue),
      ...(referenceCv === null
        ? []
        : [
            'Current tailored CV for alignment only; it is not an additional source of facts:',
            formatted(referenceCv.value),
          ]),
    ].join('\n\n'),
  })
  const value = yield* input.entry.kind === 'cv'
    ? Effect.gen(function* () {
        const document = yield* Schema.decodeUnknownEffect(CvDocumentV1Schema)(
          generated.output
        ).pipe(
          Effect.mapError((cause) =>
            refinementFailure('decode-refined-cv', cause)
          )
        )
        yield* validateCvProvenance(input.factsCatalogue, document).pipe(
          Effect.mapError((cause) =>
            refinementFailure('validate-refined-cv-provenance', cause)
          )
        )
        return document
      })
    : Schema.decodeUnknownEffect(CoverLetterDocumentSchema)(
        generated.output
      ).pipe(
        Effect.mapError((cause) =>
          refinementFailure('decode-refined-cover-letter', cause)
        )
      )
  if (value.locale !== input.entry.locale) {
    return yield* Effect.fail(
      refinementFailure(
        'validate-refined-locale',
        `Generated ${input.entry.kind === 'cv' ? 'CV' : 'cover-letter'} locale ${value.locale} did not match ${input.entry.locale}.`
      )
    )
  }
  const contract =
    input.entry.kind === 'cv'
      ? {
          id: cvDocumentV1ContractId,
          version: String(cvDocumentV1Version),
        }
      : {
          id: coverLetterContractId,
          version: coverLetterContractVersion,
        }
  const result = yield* repository.appendRevision({
    applicationId: input.applicationId,
    contractId: contract.id,
    contractVersion: contract.version,
    entry: input.entry,
    factsReleaseId: input.factsReleaseId,
    jobSnapshotId: input.jobSnapshotId,
    operationId: input.operationId,
    source: 'ai_adjustment',
    value,
  })
  if (input.entry.kind === 'cv') {
    yield* repository.stageCv({
      applicationId: input.applicationId,
      entry: result.entry,
      operationId: result.revision.operationId,
      revisionId: result.revision.id,
    })
  }
  yield* Reactivity.invalidate([
    ...contentMutationReactivityKeys(
      {
        applicationId: input.applicationId,
        kind: input.entry.kind,
        locale: input.entry.locale,
      },
      input.entry.id
    ),
    ...(input.entry.kind === 'cv'
      ? publicationMutationReactivityKeys(input.applicationId, input.entry.id)
      : []),
  ])
  return { ...result, value } satisfies SavedContentRevision
})

export const makeRefinePreparationRevisionAtom = () =>
  preparationDataRuntime.fn<RefinePreparationRevisionInput>()(
    refinePreparationRevision
  )
