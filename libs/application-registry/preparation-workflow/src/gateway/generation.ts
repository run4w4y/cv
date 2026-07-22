import { CvDocumentV1Schema } from '@cv/contracts/document'
import { Effect, Schema, Semaphore } from 'effect'

import { coverLetterJsonSchema } from '../cover-letter/ai-schema'
import { CoverLetterDocumentSchema } from '../cover-letter/contract'
import { cvDocumentV1JsonSchema } from '../cv/ai-schema'
import type {
  EvidencePlan,
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
import { toGenerationJsonSchema } from '../generation/ai-schema'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  factsForGeneration,
} from '../generation/prompts'
import type {
  StructuredGenerationRequest,
  StructuredGenerationShape,
} from '../generation/service'
import { formatted, generationStageMetadata, stageError } from './shared'
import {
  validateCvProvenance,
  validateEvidencePlan,
  validateSectionBrief,
} from './validation'

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
    schema: Schema.Codec<Output, unknown, never, never>,
    request: StructuredGenerationRequest
  ) {
    const result = yield* generationSemaphore
      .withPermits(1)(generation.generate(request))
      .pipe(stageError(stage))
    const value = yield* Schema.decodeUnknownEffect(schema)(result.output).pipe(
      stageError(stage)
    )
    return { metadata: generationStageMetadata(stage, result), value }
  })

  const analyze = Effect.fn('PreparationGateway.analyze')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap
  ) {
    const generated = yield* generate('analysis', JobAnalysisSchema, {
      instructions:
        'Analyze one job posting. Extract only information supported by the posting; do not evaluate the candidate yet. Give every requirement a short stable ID unique within this response.',
      prompt: [
        `Source URL: ${preparationSourceUrl(input.source)}`,
        `Requested locale: ${input.locale}`,
        'Captured job posting:',
        formatted(context.jobContext),
      ].join('\n\n'),
      outputSchema: toGenerationJsonSchema(JobAnalysisSchema),
    })
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
    const generated = yield* generate('evidence', EvidencePlanSchema, {
      instructions:
        'Map job requirements only to explicitly supported reviewed fact IDs. An empty factIds list is preferable to an invented or weak match. Every requirement must appear either in matches or uncoveredRequirementIds.',
      prompt: [
        'Structured job analysis:',
        formatted(analysis),
        'Trusted facts catalogue:',
        formatted(factsForGeneration(context.factsCatalogue)),
      ].join('\n\n'),
      outputSchema: toGenerationJsonSchema(EvidencePlanSchema),
    })
    const plan = yield* validateEvidencePlan(
      analysis,
      context.factsCatalogue,
      generated.value
    )
    return { metadata: generated.metadata, plan }
  })

  const brief = Effect.fn('PreparationGateway.brief')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: EvidencePlan,
    sectionId: string
  ) {
    const generated = yield* generate(
      `brief:${sectionId}`,
      SectionBriefSchema,
      {
        instructions:
          'Create a concise document-section brief. Reference only reviewed fact IDs from the supplied catalogue and return the requested sectionId exactly. Notes are planning instructions, not finished claims.',
        prompt: [
          `Document kind: ${input.kind}`,
          `Requested section: ${sectionId}`,
          'Job analysis:',
          formatted(analysis),
          'Evidence plan:',
          formatted(plan),
          'Trusted facts catalogue:',
          formatted(factsForGeneration(context.factsCatalogue)),
        ].join('\n\n'),
        outputSchema: toGenerationJsonSchema(SectionBriefSchema),
      }
    )
    const value = yield* validateSectionBrief(
      context.factsCatalogue,
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
            schema: cvDocumentV1JsonSchema,
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
            schema: coverLetterJsonSchema,
          })
        )
    const request: StructuredGenerationRequest = {
      ...baseRequest,
      prompt: [
        baseRequest.prompt,
        'Use the following verified workflow analysis and planning artifacts. They are selection guidance; the trusted facts catalogue remains authoritative:',
        'Job analysis:',
        formatted(analysis),
        'Evidence plan:',
        formatted(plan),
        'Parallel section briefs:',
        formatted(briefs),
      ].join('\n\n'),
    }

    if (input.kind === 'cv') {
      const generated = yield* generate(
        'composition',
        CvDocumentV1Schema,
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
      CoverLetterDocumentSchema,
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
