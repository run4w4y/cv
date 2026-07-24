import { Effect, Schema, Semaphore } from 'effect'

import { coverLetterGenerationContract } from '../cover-letter/ai-schema'
import { cvDocumentV1GenerationContract } from '../cv/ai-schema'
import type {
  EvidencePlan,
  GenerationStageMetadata,
  JobAnalysis,
  PreparationBootstrap,
  PreparationWorkflowInput,
  SectionBrief,
} from '../domain'
import {
  EvidencePlanSchema,
  JobAnalysisSchema,
  PreparationWorkflowError,
  preparationSourceUrl,
  SectionBriefSchema,
} from '../domain'
import {
  type GenerationContract,
  toGenerationContract,
} from '../generation/ai-schema'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  evidenceReferencesForGeneration,
  resolveEvidenceReferences,
} from '../generation/prompts'
import type {
  StructuredGenerationPrompt,
  StructuredGenerationShape,
} from '../generation/service'
import { formatted, generationStageMetadata, stageError } from './shared'
import {
  validateCvProvenance,
  validateEvidencePlan,
  validateSectionBrief,
} from './validation'

const jobAnalysisGenerationContract = toGenerationContract(JobAnalysisSchema)
const evidencePlanGenerationContract = toGenerationContract(EvidencePlanSchema)
const sectionBriefGenerationContract = toGenerationContract(SectionBriefSchema)

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

export const preparationSectionIds = (
  kind: PreparationWorkflowInput['kind']
): ReadonlyArray<string> =>
  kind === 'cv'
    ? ['profile', 'experience', 'projects', 'skills']
    : ['opening', 'evidence', 'closing']

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
          'Analyze one job posting. Extract only information supported by the posting; do not evaluate the candidate yet. Give every requirement a short stable ID unique within this response.',
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
    const evidencePlanningPrompt = [
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
          'Map job requirements to reviewed evidence citations. Use only the exact evidence IDs supplied in the selectable catalogue. Evidence IDs are source citations, not text fragments. An empty evidenceIds list is preferable to an invented or weak match. Every requirement must appear either in matches or uncoveredRequirementIds.',
        prompt: evidencePlanningPrompt,
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
          'Correct the previous evidence plan. Use only exact requirement IDs and evidence IDs printed below. Preserve truthful coverage; move a requirement to uncoveredRequirementIds rather than inventing a citation.',
        prompt: [
          evidencePlanningPrompt,
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

  const brief = Effect.fn('PreparationGateway.brief')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: EvidencePlan,
    sectionId: string
  ) {
    const references = evidenceReferencesForGeneration(context.factsCatalogue)
    const selectedReferences = resolveEvidenceReferences(
      references,
      plan.matches.flatMap(({ evidenceIds }) => evidenceIds)
    )
    const generated = yield* generate(
      `brief:${sectionId}`,
      sectionBriefGenerationContract,
      {
        instructions:
          'Create a concise document-section brief. Cite only evidence IDs selected by the validated evidence plan and return the requested sectionId exactly. Evidence IDs ground the writing; notes are planning instructions, not finished claims.',
        prompt: [
          `Document kind: ${input.kind}`,
          `Requested section: ${sectionId}`,
          'Job analysis:',
          formatted(analysis),
          'Evidence plan:',
          formatted(plan),
          'Resolved selected evidence:',
          formatted(selectedReferences),
        ].join('\n\n'),
      }
    )
    const value = yield* validateSectionBrief(
      references,
      plan,
      sectionId,
      generated.value
    )
    return { brief: value, metadata: generated.metadata }
  })

  const compose = Effect.fn('PreparationGateway.compose')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: EvidencePlan,
    briefs: ReadonlyArray<SectionBrief>
  ) {
    const references = evidenceReferencesForGeneration(context.factsCatalogue)
    const resolvedPlan = {
      ...plan,
      matches: plan.matches.map((match) => ({
        ...match,
        evidence: resolveEvidenceReferences(references, match.evidenceIds),
      })),
    }
    const resolvedBriefs = briefs.map((brief) => ({
      ...brief,
      evidence: resolveEvidenceReferences(references, brief.evidenceIds),
    }))
    const baseRequest = yield* input.kind === 'cv'
      ? Effect.gen(function* () {
          const guidance = input.cvGenerationGuidance
          if (guidance === null) {
            return yield* Effect.die(
              'Decoded CV workflow input did not contain generation guidance.'
            )
          }
          return buildCvDraftGenerationRequest({
            factsCatalogue: context.factsCatalogue,
            guidance,
            jobContext: context.jobContext,
            locale: input.locale,
          })
        })
      : Effect.succeed(
          buildCoverLetterGenerationRequest({
            factsCatalogue: context.factsCatalogue,
            jobContext: context.jobContext,
            locale: input.locale,
            prompt:
              input.coverLetterPrompt ??
              'Write a concise, specific, professional cover letter.',
          })
        )
    const request: StructuredGenerationPrompt = {
      ...baseRequest,
      prompt: [
        baseRequest.prompt,
        'Use the following verified workflow analysis and planning artifacts. Evidence IDs are citations that ground factual claims, not text fragments to concatenate. Author one coherent, role-specific document in original prose. The trusted facts catalogue remains authoritative and provides surrounding context:',
        'Job analysis:',
        formatted(analysis),
        'Evidence plan with resolved reviewed sources:',
        formatted(resolvedPlan),
        'Parallel section briefs with resolved reviewed sources:',
        formatted(resolvedBriefs),
        ...(input.kind === 'cover_letter' && context.referenceCv !== null
          ? [
              `Generated alignment input: the following tailored CV revision (${context.referenceCvRevisionId ?? 'unknown revision'}) was generated for this same URL. Keep role positioning, selected experience, and terminology consistent with it. It is not an additional source of facts; the trusted facts catalogue remains authoritative:`,
              formatted(context.referenceCv),
            ]
          : []),
      ].join('\n\n'),
    }

    if (input.kind === 'cv') {
      const generated = yield* generate(
        'composition',
        cvDocumentV1GenerationContract,
        request
      )
      if (generated.value.locale !== input.locale) {
        return yield* Effect.fail(
          new PreparationWorkflowError({
            message: `Generated CV locale ${generated.value.locale} did not match ${input.locale}.`,
            stage: 'validation',
          })
        )
      }
      yield* validateCvProvenance(context.factsCatalogue, generated.value)
      return {
        _tag: 'Cv' as const,
        document: generated.value,
        metadata: [generated.metadata],
      }
    }

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
      document: generated.value,
      metadata: [generated.metadata],
    }
  })

  return {
    analyze,
    brief,
    compose,
    planEvidence,
    sectionIds: preparationSectionIds,
  }
})
