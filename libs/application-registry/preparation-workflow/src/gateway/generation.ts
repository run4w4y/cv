import type { AiJsonGenerationRequest, AiProviderShape } from '@cv/ai-provider'
import { CvDocumentV1Schema } from '@cv/contracts/document'
import { Effect, Schema, Semaphore } from 'effect'

import { coverLetterJsonSchema } from '../cover-letter/ai-schema'
import { CoverLetterDocumentSchema } from '../cover-letter/contract'
import {
  cvDocumentV1JsonSchema,
  cvDocumentV1ModelGuidance,
} from '../cv/ai-schema'
import { toAiJsonSchema } from '../generation/ai-schema'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  factsForGeneration,
} from '../generation/prompts'
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
import { aiStageMetadata, formatted, stageError } from './shared'
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
)(function* (ai: AiProviderShape, maximumConcurrentAiCalls = 2) {
  const aiSemaphore = yield* Semaphore.make(maximumConcurrentAiCalls)

  const generate = Effect.fn('PreparationGateway.generate')(function* <Output>(
    stage: string,
    schema: Schema.Codec<Output, unknown, never, never>,
    request: AiJsonGenerationRequest
  ) {
    const result = yield* aiSemaphore
      .withPermits(1)(ai.generateJson<Output>(request))
      .pipe(stageError(stage))
    const value = yield* Schema.decodeUnknownEffect(schema)(result.output).pipe(
      stageError(stage)
    )
    return { metadata: aiStageMetadata(stage, result), value }
  })

  const analyze = Effect.fn('PreparationGateway.analyze')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap
  ) {
    const generated = yield* generate('analysis', JobAnalysisSchema, {
      instructions:
        'Analyze one job posting. Extract only information supported by the posting; do not evaluate the candidate yet. Give every requirement a short stable ID unique within this response.',
      modelId: input.modelId,
      prompt: [
        `Source URL: ${preparationSourceUrl(input.source)}`,
        `Requested locale: ${input.locale}`,
        'Captured job posting:',
        formatted(context.jobContext),
      ].join('\n\n'),
      schema: toAiJsonSchema(JobAnalysisSchema),
      schemaDescription: 'A structured analysis of the captured job posting.',
      schemaName: 'job_analysis',
    })
    return {
      analysis: generated.value,
      metadata: generated.metadata,
    }
  })

  const planEvidence = Effect.fn('PreparationGateway.planEvidence')(function* (
    input: PreparationWorkflowInput,
    context: PreparationBootstrap,
    analysis: JobAnalysis
  ) {
    const generated = yield* generate('evidence', EvidencePlanSchema, {
      instructions:
        'Map job requirements only to explicitly supported reviewed fact IDs. An empty factIds list is preferable to an invented or weak match. Every requirement must appear either in matches or uncoveredRequirementIds.',
      modelId: input.modelId,
      prompt: [
        'Structured job analysis:',
        formatted(analysis),
        'Trusted facts catalogue:',
        formatted(factsForGeneration(context.factsCatalogue)),
      ].join('\n\n'),
      schema: toAiJsonSchema(EvidencePlanSchema),
      schemaDescription: 'A requirement-to-reviewed-fact evidence plan.',
      schemaName: 'job_evidence_plan',
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
        modelId: input.modelId,
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
        schema: toAiJsonSchema(SectionBriefSchema),
        schemaDescription: `A planning brief for ${sectionId}.`,
        schemaName: `section_brief_${sectionId}`,
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
    const baseRequest =
      input.kind === 'cv'
        ? buildCvDraftGenerationRequest({
            factsCatalogue: context.factsCatalogue,
            guidance: cvDocumentV1ModelGuidance,
            jobContext: context.jobContext,
            locale: input.locale,
            modelId: input.modelId,
            schema: cvDocumentV1JsonSchema,
          })
        : buildCoverLetterGenerationRequest({
            factsCatalogue: context.factsCatalogue,
            jobContext: context.jobContext,
            locale: input.locale,
            modelId: input.modelId,
            prompt:
              input.coverLetterPrompt ??
              'Write a concise, specific, professional cover letter.',
            schema: coverLetterJsonSchema,
          })
    const request: AiJsonGenerationRequest = {
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
