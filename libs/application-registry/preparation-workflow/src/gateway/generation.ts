import { Effect, Schema, Semaphore } from 'effect'

import { coverLetterGenerationContract } from '../cover-letter/ai-schema'
import { cvDocumentV1GenerationContract } from '../cv/ai-schema'
import type {
  CoverLetterPreparationInput,
  CvAuthoringItem,
  CvAuthoringPlan,
  CvPreparationInput,
  EvidencePlan,
  GenerationStageMetadata,
  JobAnalysis,
  PreparationBootstrap,
  PreparationWorkflowInput,
} from '../domain'
import {
  CvAuthoringPlanSchema,
  EvidencePlanSchema,
  JobAnalysisSchema,
  PreparationWorkflowError,
  preparationSourceUrl,
} from '../domain'
import {
  type GenerationContract,
  toGenerationContract,
} from '../generation/ai-schema'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  type CvAuthoringSource,
  cvAuthoringSourceForGeneration,
  evidenceReferencesForGeneration,
  resolveEvidenceReferences,
} from '../generation/prompts'
import type {
  StructuredGenerationPrompt,
  StructuredGenerationShape,
} from '../generation/service'
import { formatted, generationStageMetadata, stageError } from './shared'
import {
  cvAuthoringPolicyForGeneration,
  validateCvAuthoringPlan,
  validateCvDocumentAuthoring,
  validateCvProvenance,
  validateCvWriting,
  validateEvidencePlan,
} from './validation'

const jobAnalysisGenerationContract = toGenerationContract(JobAnalysisSchema)
const evidencePlanGenerationContract = toGenerationContract(EvidencePlanSchema)
const cvAuthoringPlanGenerationContract = toGenerationContract(
  CvAuthoringPlanSchema
)

const sumUsage = (values: ReadonlyArray<number | null>): number | null => {
  let total = 0
  for (const value of values) {
    if (value === null) return null
    total += value
  }
  return total
}

const combineGenerationMetadata = (
  stage: string,
  entries: ReadonlyArray<GenerationStageMetadata>
): GenerationStageMetadata => ({
  executor: entries.at(-1)?.executor ?? 'unknown',
  stage,
  usage: {
    inputTokens: sumUsage(entries.map(({ usage }) => usage.inputTokens)),
    outputTokens: sumUsage(entries.map(({ usage }) => usage.outputTokens)),
    totalTokens: sumUsage(entries.map(({ usage }) => usage.totalTokens)),
  },
})

const selectedEvidenceIds = (plan: EvidencePlan): ReadonlyArray<string> => [
  ...new Set(plan.requirements.flatMap(({ evidenceIds }) => evidenceIds)),
]

const missingPlanBinding = (
  section: string,
  id: string
): PreparationWorkflowError =>
  new PreparationWorkflowError({
    message: `Validated CV authoring plan references missing ${section} binding ${id}.`,
    stage: 'validation',
  })

const resolvePlannedItems = <
  Binding extends { readonly id: string },
  Item extends CvAuthoringItem,
>(
  section: string,
  bindings: ReadonlyArray<Binding>,
  items: ReadonlyArray<Item>,
  references: CvAuthoringSource['references'],
  metadata: (binding: Binding) => unknown = (binding) => binding
) => {
  const byId = new Map(bindings.map((binding) => [binding.id, binding]))
  return Effect.forEach(items, (item) => {
    const binding = byId.get(item.id)
    return binding === undefined
      ? Effect.fail(missingPlanBinding(section, item.id))
      : Effect.succeed({
          evidence: resolveEvidenceReferences(references, item.evidenceIds),
          id: item.id,
          metadata: metadata(binding),
        })
  })
}

const cvAuthoringPacket = Effect.fn('PreparationGateway.cvAuthoringPacket')(
  function* (
    source: CvAuthoringSource,
    plan: CvAuthoringPlan,
    educationDatesRequired: boolean
  ) {
    const additionalById = new Map(
      source.additionalSectionItems.map((item) => [item.id, item])
    )
    const additionalItems = yield* Effect.forEach(
      plan.additionalEvidenceIds,
      (id) => {
        const binding = additionalById.get(id)
        return binding === undefined
          ? Effect.fail(missingPlanBinding('additional-section', id))
          : Effect.succeed(binding)
      }
    )
    const education = yield* resolvePlannedItems(
      'education',
      source.education,
      plan.education,
      source.references,
      ({ evidenceIds: _evidenceIds, period, ...binding }) =>
        educationDatesRequired ? { ...binding, period } : binding
    )
    const experience = yield* resolvePlannedItems(
      'experience',
      source.experience,
      plan.experience,
      source.references,
      ({ evidenceIds: _evidenceIds, ...binding }) => binding
    )
    const projects = yield* resolvePlannedItems(
      'project',
      source.projects,
      plan.projects,
      source.references,
      ({ evidenceIds: _evidenceIds, ...binding }) => binding
    )
    const skillGroups = yield* resolvePlannedItems(
      'skill-group',
      source.skillGroups,
      plan.skillGroups,
      source.references,
      ({ evidenceIds: _evidenceIds, ...binding }) => binding
    )
    return {
      additionalItems,
      education,
      experience,
      person: source.person,
      profileEvidence: resolveEvidenceReferences(
        source.references,
        plan.profileEvidenceIds
      ),
      projects,
      skillGroups,
    }
  }
)

export const makePreparationGenerationGateway = Effect.fn(
  'PreparationGateway.makeGenerationGateway'
)(function* (
  generation: StructuredGenerationShape,
  maximumConcurrentGenerationCalls = 2
) {
  const generationSemaphore = yield* Semaphore.make(
    maximumConcurrentGenerationCalls
  )

  const generate = Effect.fn('PreparationGateway.generate')(function* <Output>(
    stage: string,
    contract: GenerationContract<Output>,
    request: StructuredGenerationPrompt
  ) {
    const result = yield* generationSemaphore
      .withPermits(1)(
        generation.generate({
          ...request,
          outputSchema: contract.outputSchema,
        })
      )
      .pipe(stageError(stage))
    const value = yield* Schema.decodeUnknownEffect(contract.codec)(
      result.output
    ).pipe(stageError(stage))
    return { metadata: generationStageMetadata(stage, result), value }
  })

  const analyze = Effect.fn('PreparationGateway.analyze')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap
  ) {
    const generated = yield* generate(
      'analysis',
      jobAnalysisGenerationContract,
      {
        instructions:
          'Analyze one job posting. Extract only information supported by the posting; do not evaluate the candidate yet. Give every requirement a short stable ID unique within this response. Set educationDatesRequired to true only when the posting explicitly requires an education, degree, or graduation date.',
        prompt: [
          `Source URL: ${preparationSourceUrl(input.source)}`,
          `Requested locale: ${input.locale}`,
          'Captured job posting:',
          formatted(context.jobContext),
        ].join('\n\n'),
      }
    )
    return {
      analysis: generated.value,
      metadata: generated.metadata,
    }
  })

  const planEvidence = Effect.fn('PreparationGateway.planEvidence')(function* (
    _input: PreparationWorkflowInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis
  ) {
    const references = evidenceReferencesForGeneration(context.factsCatalogue)
    const planningPrompt = [
      'Structured job analysis:',
      formatted(analysis),
      'Selectable reviewed evidence catalogue:',
      formatted(references),
    ].join('\n\n')
    const generated = yield* generate(
      'evidence',
      evidencePlanGenerationContract,
      {
        instructions:
          'Map every job requirement to reviewed evidence citations. Return each exact requirement ID once and in the supplied order. Use only exact evidence IDs from the catalogue. Use an empty evidenceIds list when the requirement is unsupported; never invent or weaken a citation. Return identifiers only, without strategy or rationale.',
        prompt: planningPrompt,
      }
    )
    const validation = yield* validateEvidencePlan(
      analysis,
      references,
      generated.value
    ).pipe(
      Effect.map((plan) => ({ _tag: 'Valid' as const, plan })),
      Effect.catch((error) =>
        Effect.succeed({ _tag: 'Invalid' as const, error })
      )
    )
    if (validation._tag === 'Valid') {
      return { metadata: generated.metadata, plan: validation.plan }
    }

    const repaired = yield* generate(
      'evidence:repair',
      evidencePlanGenerationContract,
      {
        instructions:
          'Correct the evidence plan using only the supplied exact requirement and evidence IDs. Return every requirement exactly once in order. Preserve empty evidenceIds for unsupported requirements. Return identifiers only.',
        prompt: [
          planningPrompt,
          'Previous invalid evidence plan:',
          formatted(generated.value),
          'Deterministic validation failure:',
          validation.error.message,
          'Return one corrected complete evidence plan.',
        ].join('\n\n'),
      }
    )
    const plan = yield* validateEvidencePlan(
      analysis,
      references,
      repaired.value
    )
    return {
      metadata: combineGenerationMetadata('evidence', [
        generated.metadata,
        repaired.metadata,
      ]),
      plan,
    }
  })

  const planCv = Effect.fn('PreparationGateway.planCv')(function* (
    _input: CvPreparationInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis,
    evidencePlan: EvidencePlan
  ) {
    const source = cvAuthoringSourceForGeneration(context.factsCatalogue)
    const policy = cvAuthoringPolicyForGeneration(source)
    const planningPrompt = [
      'Target role terminology and responsibilities:',
      formatted({
        keywords: analysis.keywords,
        location: analysis.location,
        requirements: analysis.requirements,
        responsibilities: analysis.responsibilities,
        role: analysis.role,
      }),
      'Validated requirement evidence:',
      formatted(evidencePlan),
      'Deterministic experience-first selection policy. The budgets are validator inputs, not output fields:',
      formatted(policy),
      'Reviewed authoring source with exact provenance bindings and evidence ownership:',
      formatted(source),
    ].join('\n\n')
    const generated = yield* generate(
      'planning',
      cvAuthoringPlanGenerationContract,
      {
        instructions:
          'Create one identifier-only CV authoring plan. Select experience and projects within the supplied deterministic budgets, prioritize employment, and order by role relevance then recency. Allocate only role-selected evidence owned by each item. Select only relevant skill groups, education, profile evidence, and additional evidence. Education periods are omitted by default and are not part of this plan. Return IDs only, without budgets, strategy, rationale, objectives, notes, or prose.',
        prompt: planningPrompt,
      }
    )
    const validation = yield* validateCvAuthoringPlan(
      context.factsCatalogue,
      evidencePlan,
      generated.value
    ).pipe(
      Effect.map((plan) => ({ _tag: 'Valid' as const, plan })),
      Effect.catch((error) =>
        Effect.succeed({ _tag: 'Invalid' as const, error })
      )
    )
    if (validation._tag === 'Valid') {
      return { metadata: generated.metadata, plan: validation.plan }
    }

    const repaired = yield* generate(
      'planning:repair',
      cvAuthoringPlanGenerationContract,
      {
        instructions:
          'Repair the CV authoring plan using only supplied exact IDs. Satisfy deterministic selection budgets, keep projects subordinate to experience, and allocate only role-selected evidence owned by each item. Return IDs only.',
        prompt: [
          planningPrompt,
          'Previous invalid authoring plan:',
          formatted(generated.value),
          'Deterministic validation failure:',
          validation.error.message,
          'Return one corrected complete authoring plan.',
        ].join('\n\n'),
      }
    )
    const plan = yield* validateCvAuthoringPlan(
      context.factsCatalogue,
      evidencePlan,
      repaired.value
    )
    return {
      metadata: combineGenerationMetadata('planning', [
        generated.metadata,
        repaired.metadata,
      ]),
      plan,
    }
  })

  const composeCv = Effect.fn('PreparationGateway.composeCv')(function* (
    input: CvPreparationInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: CvAuthoringPlan
  ) {
    const source = cvAuthoringSourceForGeneration(context.factsCatalogue)
    const packet = yield* cvAuthoringPacket(
      source,
      plan,
      analysis.educationDatesRequired
    )
    const baseRequest = buildCvDraftGenerationRequest({
      guidance: input.generationGuidance,
      job: {
        keywords: analysis.keywords,
        location: analysis.location,
        responsibilities: analysis.responsibilities,
        role: analysis.role,
      },
      locale: input.locale,
    })
    const request: StructuredGenerationPrompt = {
      ...baseRequest,
      prompt: [
        baseRequest.prompt,
        'Final CV authoring packet. This is the complete allowed composition. Include every listed item exactly once and in order. Copy IDs and metadata exactly. Education periods are present only when the posting explicitly requires them; never add an omitted period. Use only resolved reviewed evidence for personal claims.',
        'For each skill group, include exactly the names represented by its resolved evidence entries of kind "skill".',
        formatted(packet),
      ].join('\n\n'),
    }
    const validateDocument = Effect.fn(
      'PreparationGateway.validateGeneratedCv'
    )(function* (document: typeof cvDocumentV1GenerationContract.codec.Type) {
      if (document.locale !== input.locale) {
        return yield* Effect.fail(
          new PreparationWorkflowError({
            message: `Generated CV locale ${document.locale} did not match ${input.locale}.`,
            stage: 'validation',
          })
        )
      }
      yield* validateCvProvenance(context.factsCatalogue, document)
      yield* validateCvDocumentAuthoring(
        context.factsCatalogue,
        plan,
        document,
        analysis.educationDatesRequired
      )
      yield* validateCvWriting(
        input.generationGuidance,
        analysis.company,
        document
      )
      return document
    })
    const generated = yield* generate(
      'composition',
      cvDocumentV1GenerationContract,
      request
    )
    const validation = yield* validateDocument(generated.value).pipe(
      Effect.map((document) => ({ _tag: 'Valid' as const, document })),
      Effect.catch((error) =>
        Effect.succeed({ _tag: 'Invalid' as const, error })
      )
    )
    if (validation._tag === 'Valid') {
      return {
        _tag: 'Cv' as const,
        document: validation.document,
        metadata: [generated.metadata],
      }
    }

    const repaired = yield* generate(
      'composition:repair',
      cvDocumentV1GenerationContract,
      {
        instructions:
          'Repair the CV so it satisfies provenance, the authoring plan, and pinned writing guidance. Preserve supported content, exact IDs, metadata, and order. Write natural finished CV copy, obey word limits, keep the target company and application-analysis language out of the summary, and include education periods only when they appear in the authoring packet.',
        prompt: [
          request.prompt,
          'Previous invalid CV:',
          formatted(generated.value),
          'Deterministic validation failure:',
          validation.error.message,
          'Return one complete corrected CV document.',
        ].join('\n\n'),
      }
    )
    const document = yield* validateDocument(repaired.value)
    return {
      _tag: 'Cv' as const,
      document,
      metadata: [
        combineGenerationMetadata('composition', [
          generated.metadata,
          repaired.metadata,
        ]),
      ],
    }
  })

  const composeCoverLetter = Effect.fn('PreparationGateway.composeCoverLetter')(
    function* (
      input: CoverLetterPreparationInput,
      context: PreparationBootstrap,
      analysis: JobAnalysis,
      evidencePlan: EvidencePlan
    ) {
      if (
        context.referenceCv === null ||
        context.referenceCvRevisionId === null
      ) {
        return yield* Effect.fail(
          new PreparationWorkflowError({
            message:
              'Cover-letter generation requires an approved CV revision.',
            stage: 'composition',
          })
        )
      }
      const references = evidenceReferencesForGeneration(context.factsCatalogue)
      const request = buildCoverLetterGenerationRequest({
        approvedCv: context.referenceCv,
        evidence: resolveEvidenceReferences(
          references,
          selectedEvidenceIds(evidencePlan)
        ),
        job: {
          company: analysis.company,
          keywords: analysis.keywords,
          location: analysis.location,
          responsibilities: analysis.responsibilities,
          role: analysis.role,
        },
        locale: input.locale,
        prompt: input.prompt,
      })
      const generated = yield* generate(
        'composition',
        coverLetterGenerationContract,
        request
      )
      if (generated.value.locale !== input.locale) {
        return yield* Effect.fail(
          new PreparationWorkflowError({
            message: `Generated cover-letter locale ${generated.value.locale} did not match ${input.locale}.`,
            stage: 'validation',
          })
        )
      }
      return {
        _tag: 'CoverLetter' as const,
        document: {
          ...generated.value,
          referenceCvRevisionId: context.referenceCvRevisionId,
        },
        metadata: [generated.metadata],
      }
    }
  )

  return {
    analyze,
    composeCoverLetter,
    composeCv,
    planCv,
    planEvidence,
  }
})
