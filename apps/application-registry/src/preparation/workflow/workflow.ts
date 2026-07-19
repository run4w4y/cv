import {
  ApplicationResponseSchema,
  ContentRevisionResultResponseSchema,
} from '@cv/application-registry-api-contract'
import {
  Cause,
  Context,
  type Duration,
  Effect,
  Exit,
  Layer,
  Schedule,
  Schema,
  Semaphore,
} from 'effect'
import * as Activity from 'effect/unstable/workflow/Activity'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  candidateMatchesDocumentKind,
  EvidencePlanResultSchema,
  GeneratedCandidateSchema,
  HumanReview,
  JobAnalysisResultSchema,
  PreparationBootstrapSchema,
  PreparationWorkflowError,
  type PreparationWorkflowInput,
  PrepareApplicationWorkflow,
  preparationSourceApplicationId,
  SavedCandidateSchema,
  SectionBriefResultSchema,
} from './domain'
import { PreparationGateway } from './gateway'
import { PreparationProgress } from './progress'

type ConcurrencyService = {
  readonly withJobSlot: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
}

export class PreparationConcurrency extends Context.Service<
  PreparationConcurrency,
  ConcurrencyService
>()('@cv/application-registry/PreparationConcurrency') {}

export const preparationConcurrencyLayer = Layer.effect(
  PreparationConcurrency,
  Effect.gen(function* () {
    const jobs = yield* Semaphore.make(3)
    return PreparationConcurrency.of({
      withJobSlot: jobs.withPermits(1),
    })
  })
)

// A browser-session cancellation is an explicit user decision. The Workflow
// Activity default retries an interrupted effect, which is useful for durable
// workers but would repeat network and AI work after the user cancelled.
const stopActivityInterruptRetries = Schedule.recurs(0).pipe(
  Schedule.setInputType<Cause.Cause<unknown>>()
)

const withActivityTimeout = <A, R>(
  stage: string,
  duration: Duration.Input,
  effect: Effect.Effect<A, PreparationWorkflowError, R>
): Effect.Effect<A, PreparationWorkflowError, R> =>
  effect.pipe(
    Effect.timeout(duration),
    Effect.mapError((error) =>
      error._tag === 'PreparationWorkflowError'
        ? error
        : new PreparationWorkflowError({
            message: `The ${stage} activity exceeded its ${String(duration)} time limit.`,
            stage,
          })
    )
  )

const executePreparation = Effect.fn('PrepareApplication.run')(
  function* (input: PreparationWorkflowInput) {
    const gateway = yield* PreparationGateway
    const progress = yield* PreparationProgress
    const concurrency = yield* PreparationConcurrency

    // One permit represents one actively preparing job. Activities within a
    // job do not compete for this semaphore; the gateway separately bounds AI
    // calls. Human-review suspension releases the job permit.
    const prepared = yield* concurrency.withJobSlot(
      Effect.gen(function* () {
        yield* progress.stage(
          input.runId,
          'application',
          preparationSourceApplicationId(input.source) === null
            ? 'Creating an application record for this URL.'
            : 'Starting application preparation.'
        )
        const initialApplication = yield* Activity.make({
          name: 'ensure-application',
          success: ApplicationResponseSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'application',
            '30 seconds',
            gateway.ensureApplication(input)
          ),
        })
        yield* progress.stage(
          input.runId,
          'capture',
          'Application ready. Capturing the canonical job posting.',
          initialApplication.id
        )
        const initialContext = yield* Activity.make({
          name: 'capture-bootstrap',
          success: PreparationBootstrapSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'capture',
            '90 seconds',
            gateway.bootstrap(input, initialApplication)
          ),
        })
        yield* progress.stage(
          input.runId,
          'analysis',
          'Captured the posting and loaded the active facts release.',
          initialContext.application.id
        )

        yield* progress.stage(
          input.runId,
          'analysis',
          'Extracting the role, responsibilities, and requirements.'
        )
        const analysis = yield* Activity.make({
          name: 'job-analysis',
          success: JobAnalysisResultSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'analysis',
            '2 minutes',
            gateway.analyze(input, initialContext)
          ),
        })

        const application = yield* Activity.make({
          name: 'enrich-application',
          success: ApplicationResponseSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'application',
            '30 seconds',
            gateway.enrichApplication(input, initialContext, analysis.analysis)
          ),
        })
        const context = {
          ...initialContext,
          application,
        }

        yield* progress.stage(
          input.runId,
          'evidence',
          'Mapping requirements to reviewed fact IDs.',
          application.id
        )
        const evidence = yield* Activity.make({
          name: 'evidence-plan',
          success: EvidencePlanResultSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'evidence',
            '2 minutes',
            gateway.planEvidence(input, context, analysis.analysis)
          ),
        })

        yield* progress.stage(
          input.runId,
          'briefs',
          'Building section briefs with bounded parallel AI calls.'
        )
        const briefs = yield* Effect.forEach(
          gateway.sectionIds(input.kind),
          (sectionId) =>
            Activity.make({
              name: `section-brief/${sectionId}`,
              success: SectionBriefResultSchema,
              error: PreparationWorkflowError,
              interruptRetryPolicy: stopActivityInterruptRetries,
              execute: withActivityTimeout(
                'briefs',
                '2 minutes',
                gateway.brief(
                  input,
                  context,
                  analysis.analysis,
                  evidence.plan,
                  sectionId
                )
              ),
            }),
          { concurrency: 2 }
        )

        yield* progress.stage(
          input.runId,
          'composition',
          'Composing one coherent final document from the plan.'
        )
        const composed = yield* Activity.make({
          name: 'compose-document',
          success: GeneratedCandidateSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'composition',
            '3 minutes',
            gateway.compose(
              input,
              context,
              analysis.analysis,
              evidence.plan,
              briefs.map(({ brief }) => brief)
            )
          ),
        })
        const candidate = {
          _tag: composed._tag,
          document: composed.document,
          metadata: [
            analysis.metadata,
            evidence.metadata,
            ...briefs.map(({ metadata }) => metadata),
            ...composed.metadata,
          ],
        }

        yield* progress.stage(
          input.runId,
          'validation',
          'Checking the document contract and provenance references.'
        )
        const validated = yield* Activity.make({
          name: 'validate-candidate',
          success: GeneratedCandidateSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: Schema.decodeUnknownEffect(GeneratedCandidateSchema)(
            candidate
          ).pipe(
            Effect.filterOrFail(
              (decoded) => candidateMatchesDocumentKind(decoded, input.kind),
              () =>
                new PreparationWorkflowError({
                  message: `Generated ${candidate._tag} candidate did not match requested document kind ${input.kind}.`,
                  stage: 'validation',
                })
            ),
            Effect.mapError((cause) =>
              cause._tag === 'PreparationWorkflowError'
                ? cause
                : new PreparationWorkflowError({
                    message: String(cause),
                    stage: 'validation',
                  })
            )
          ),
        })

        yield* progress.stage(
          input.runId,
          'saving',
          'Saving the AI candidate as an unapproved revision.'
        )
        const saved = yield* Activity.make({
          name: 'save-candidate',
          success: SavedCandidateSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'saving',
            '30 seconds',
            gateway.saveCandidate(input, context, validated)
          ),
        })

        return saved
      })
    )

    const reviewToken = yield* DurableDeferred.token(HumanReview)
    yield* progress.reviewReady(
      input.runId,
      prepared.application.id,
      prepared,
      reviewToken
    )
    const decision = yield* DurableDeferred.await(HumanReview)

    if (decision._tag === 'Approved') {
      const approved = yield* Activity.make({
        name: 'approve-bound-revision',
        success: ContentRevisionResultResponseSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'review',
          '30 seconds',
          gateway.approveBoundRevision(prepared, decision.revisionId)
        ),
      })
      yield* progress.complete(input.runId, {
        message: 'Human review approved the prepared revision.',
        result: approved,
        status: 'approved',
      })
      return {
        applicationId: prepared.application.id,
        revisionId: approved.revision.id,
        runId: input.runId,
        status: 'approved' as const,
      }
    }

    yield* progress.complete(input.runId, {
      message: `Human review rejected the candidate: ${decision.reason}`,
      status: 'rejected',
    })
    return {
      applicationId: prepared.application.id,
      revisionId: null,
      runId: input.runId,
      status: 'rejected' as const,
    }
  },
  (effect, input) =>
    Effect.gen(function* () {
      const progress = yield* PreparationProgress
      const instance = yield* WorkflowEngine.WorkflowInstance
      return yield* effect.pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) return Effect.void
          if (Cause.hasInterruptsOnly(exit.cause)) {
            if (instance.suspended && !instance.interrupted) {
              return Effect.void
            }
            return progress.cancel(input.runId)
          }
          return progress.fail(input.runId, Cause.pretty(exit.cause))
        })
      )
    })
)

export const preparationWorkflowLayer =
  PrepareApplicationWorkflow.toLayer(executePreparation)
