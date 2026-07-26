import { ApplicationSchema } from '@cv/application-registry-entity'
import {
  Cause,
  Context,
  type Duration,
  Effect,
  Exit,
  Layer,
  Schedule,
  Semaphore,
} from 'effect'
import * as Activity from 'effect/unstable/workflow/Activity'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  ContentRevisionResultSchema,
  type CoverLetterPreparationInput,
  CvAuthoringPlanResultSchema,
  type CvPreparationInput,
  type EvidencePlan,
  EvidencePlanResultSchema,
  type GeneratedCandidate,
  GeneratedCoverLetterCandidateSchema,
  GeneratedCvCandidateSchema,
  type JobAnalysis,
  JobAnalysisResultSchema,
  type PreparationArtifactWorkflowResult,
  type PreparationBootstrap,
  PreparationBootstrapSchema,
  PreparationWorkflowError,
  type PreparationWorkflowInput,
  type PreparationWorkflowPayload,
  PrepareApplicationWorkflow,
  preparationApprovalDeferred,
  preparationJobCoverLetterInput,
  preparationJobCvInput,
  SavedCandidateSchema,
} from '../domain'
import { PreparationGateway } from '../gateway'
import { PreparationProgress } from '../progress'

type ConcurrencyService = {
  readonly withJobSlot: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
}

export class PreparationConcurrency extends Context.Service<
  PreparationConcurrency,
  ConcurrencyService
>()('@cv/application-registry/PreparationConcurrency') {}

export const makePreparationConcurrencyLayer = (
  maximumConcurrentJobs: number
) =>
  Layer.effect(
    PreparationConcurrency,
    Effect.gen(function* () {
      const jobs = yield* Semaphore.make(maximumConcurrentJobs)
      return PreparationConcurrency.of({
        withJobSlot: jobs.withPermits(1),
      })
    })
  )

export const preparationConcurrencyLayer = makePreparationConcurrencyLayer(3)

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
    Effect.catchTag('TimeoutError', () =>
      Effect.fail(
        new PreparationWorkflowError({
          message: `The ${stage} activity exceeded its ${String(duration)} time limit.`,
          stage,
        })
      )
    )
  )

const executePreparation = Effect.fn('PrepareApplication.run')(
  function* (payload: PreparationWorkflowPayload) {
    const input = payload
    const gateway = yield* PreparationGateway
    const progress = yield* PreparationProgress
    const concurrency = yield* PreparationConcurrency
    const cvInput = preparationJobCvInput(input)
    const coverLetterInput = preparationJobCoverLetterInput(input)
    const primaryInput = cvInput ?? coverLetterInput
    if (primaryInput === null) {
      return yield* Effect.die(
        'Decoded preparation job did not contain an artifact input.'
      )
    }

    const savePreparedCandidate = Effect.fn(
      'PrepareApplication.savePreparedCandidate'
    )(function* (
      artifactInput: PreparationWorkflowInput,
      context: PreparationBootstrap,
      candidate: GeneratedCandidate
    ) {
      const { kind } = artifactInput
      yield* progress.stageArtifact(
        input.jobId,
        kind,
        'validation',
        'Validating the generated document and its requested format.'
      )
      yield* progress.stageArtifact(
        input.jobId,
        kind,
        'saving',
        'Saving the AI candidate as an unapproved revision.'
      )
      return yield* Activity.make({
        name: `${kind}/save-candidate`,
        success: SavedCandidateSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'saving',
          '30 seconds',
          gateway.saveCandidate(artifactInput, context, candidate)
        ),
      })
    })

    const prepareCv = Effect.fn('PrepareApplication.prepareCv')(function* (
      artifactInput: CvPreparationInput,
      context: PreparationBootstrap,
      analysis: JobAnalysis,
      evidence: EvidencePlan
    ) {
      yield* progress.stageArtifact(
        input.jobId,
        'cv',
        'planning',
        'Selecting and allocating reviewed evidence for the tailored CV.'
      )
      const plan = yield* Activity.make({
        name: 'cv/authoring-plan',
        success: CvAuthoringPlanResultSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'planning',
          '2 minutes',
          gateway.planCv(artifactInput, context, analysis, evidence)
        ),
      })
      yield* progress.stageArtifact(
        input.jobId,
        'cv',
        'composition',
        'Composing one coherent CV from the validated authoring plan.'
      )
      const composed = yield* Activity.make({
        name: 'cv/compose-document',
        success: GeneratedCvCandidateSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'composition',
          '3 minutes',
          gateway.composeCv(artifactInput, context, analysis, plan.plan)
        ),
      })
      return yield* savePreparedCandidate(artifactInput, context, {
        ...composed,
        metadata: [plan.metadata, ...composed.metadata],
      })
    })

    const prepareCoverLetter = Effect.fn(
      'PrepareApplication.prepareCoverLetter'
    )(function* (
      artifactInput: CoverLetterPreparationInput,
      context: PreparationBootstrap,
      analysis: JobAnalysis,
      evidence: EvidencePlan
    ) {
      yield* progress.stageArtifact(
        input.jobId,
        'cover_letter',
        'composition',
        'Composing a cover letter from the approved CV and reviewed evidence.'
      )
      const composed = yield* Activity.make({
        name: 'cover_letter/compose-document',
        success: GeneratedCoverLetterCandidateSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'composition',
          '3 minutes',
          gateway.composeCoverLetter(artifactInput, context, analysis, evidence)
        ),
      })
      return yield* savePreparedCandidate(artifactInput, context, composed)
    })

    const reviewSavedArtifact = Effect.fn(
      'PrepareApplication.reviewSavedArtifact'
    )(function* (
      artifactInput: PreparationWorkflowInput,
      saved: typeof SavedCandidateSchema.Type
    ) {
      const approval = yield* DurableDeferred.await(
        preparationApprovalDeferred(artifactInput.kind)
      )
      const approved = yield* Activity.make({
        name: `${artifactInput.kind}/approve-bound-revision`,
        success: ContentRevisionResultSchema,
        error: PreparationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: withActivityTimeout(
          'review',
          '30 seconds',
          gateway.approveBoundRevision(saved, approval.revisionId)
        ),
      })
      yield* progress.approveArtifact(input.jobId, artifactInput.kind, {
        message: 'Human review approved the prepared revision.',
        result: approved,
      })
      return {
        kind: artifactInput.kind,
        revisionId: approved.revision.id,
        status: 'approved' as const,
      }
    })

    // A generation permit is held only while machine work is active. Human
    // review releases it. Shared analysis is authoritative and emitted once.
    const prepared = yield* concurrency.withJobSlot(
      Effect.gen(function* () {
        yield* progress.stageShared(
          input.jobId,
          'application',
          input.target._tag === 'PostingUrl'
            ? 'Creating an application record for this URL.'
            : 'Starting application preparation.'
        )
        const initialApplication = yield* Activity.make({
          name: 'ensure-application',
          success: ApplicationSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'application',
            '30 seconds',
            gateway.ensureApplication(primaryInput)
          ),
        })
        yield* progress.stageShared(
          input.jobId,
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
            gateway.bootstrap(primaryInput, initialApplication)
          ),
        })
        yield* progress.stageShared(
          input.jobId,
          'analysis',
          'Captured the posting. Extracting the role, responsibilities, and requirements.',
          initialContext.application.id
        )
        const analysis = yield* Activity.make({
          name: 'job-analysis',
          success: JobAnalysisResultSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'analysis',
            '2 minutes',
            gateway.analyze(primaryInput, initialContext)
          ),
        })
        const application = yield* Activity.make({
          name: 'enrich-application',
          success: ApplicationSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'application',
            '30 seconds',
            gateway.enrichApplication(
              primaryInput,
              initialContext,
              analysis.analysis
            )
          ),
        })
        yield* progress.identify(input.jobId, {
          applicationId: application.id,
          company: analysis.analysis.company,
          role: analysis.analysis.role,
        })
        const context = { ...initialContext, application }
        yield* progress.stageShared(
          input.jobId,
          'evidence',
          'Mapping requirements to reviewed evidence.',
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
            gateway.planEvidence(primaryInput, context, analysis.analysis)
          ),
        })
        const sharedMetadata = [analysis.metadata, evidence.metadata]
        const cvSaved =
          cvInput === null
            ? null
            : yield* prepareCv(
                cvInput,
                context,
                analysis.analysis,
                evidence.plan
              ).pipe(
                Effect.map((saved) => ({
                  ...saved,
                  candidate: {
                    ...saved.candidate,
                    metadata: [...sharedMetadata, ...saved.candidate.metadata],
                  },
                })),
                Effect.tapError((error) =>
                  Effect.gen(function* () {
                    yield* progress.failArtifact(
                      input.jobId,
                      'cv',
                      error.message
                    )
                    if (coverLetterInput !== null) {
                      yield* progress.blockArtifact(
                        input.jobId,
                        'cover_letter',
                        'Cover-letter generation was blocked because the tailored CV failed.'
                      )
                    }
                  })
                )
              )
        if (cvSaved !== null) {
          const reviewToken = yield* DurableDeferred.token(
            preparationApprovalDeferred('cv')
          )
          yield* progress.reviewReady(
            input.jobId,
            'cv',
            application.id,
            cvSaved,
            reviewToken
          )
        }
        return {
          analysis,
          application,
          context,
          cvSaved,
          evidence,
          sharedMetadata,
        }
      })
    )

    const cvResult =
      cvInput === null || prepared.cvSaved === null
        ? null
        : yield* reviewSavedArtifact(cvInput, prepared.cvSaved).pipe(
            Effect.catch((error) =>
              progress.failArtifact(input.jobId, 'cv', error.message).pipe(
                Effect.as({
                  kind: 'cv' as const,
                  revisionId: null,
                  status: 'failed' as const,
                })
              )
            )
          )

    const coverLetterBlocked =
      coverLetterInput !== null &&
      cvInput !== null &&
      cvResult?.status !== 'approved'
    if (coverLetterBlocked) {
      yield* progress.blockArtifact(
        input.jobId,
        'cover_letter',
        'Cover-letter generation requires an accepted CV revision.'
      )
    }

    const coverLetterSaved =
      coverLetterInput === null || coverLetterBlocked
        ? null
        : yield* concurrency
            .withJobSlot(
              Effect.gen(function* () {
                const letterContext =
                  cvInput === null
                    ? prepared.context
                    : yield* Activity.make({
                        name: 'cover_letter/load-approved-cv-context',
                        success: PreparationBootstrapSchema,
                        error: PreparationWorkflowError,
                        interruptRetryPolicy: stopActivityInterruptRetries,
                        execute: withActivityTimeout(
                          'capture',
                          '30 seconds',
                          gateway.bootstrap(
                            {
                              ...coverLetterInput,
                              source: {
                                _tag: 'ReviewedContext',
                                applicationId: prepared.application.id,
                                factsReleaseId: prepared.context.factsReleaseId,
                                jobSnapshotId: prepared.context.jobSnapshot.id,
                                url: input.target.url,
                              },
                            },
                            prepared.application
                          )
                        ),
                      })
                if (
                  letterContext.referenceCvRevisionId === null ||
                  (cvResult?.status === 'approved' &&
                    letterContext.referenceCvRevisionId !== cvResult.revisionId)
                ) {
                  return yield* Effect.fail(
                    new PreparationWorkflowError({
                      message:
                        'The approved CV changed before cover-letter generation could bind it.',
                      stage: 'capture',
                    })
                  )
                }
                const saved = yield* prepareCoverLetter(
                  coverLetterInput,
                  letterContext,
                  prepared.analysis.analysis,
                  prepared.evidence.plan
                )
                return {
                  ...saved,
                  candidate: {
                    ...saved.candidate,
                    metadata: [
                      ...prepared.sharedMetadata,
                      ...saved.candidate.metadata,
                    ],
                  },
                }
              })
            )
            .pipe(
              Effect.matchEffect({
                onFailure: (error) =>
                  progress
                    .failArtifact(input.jobId, 'cover_letter', error.message)
                    .pipe(Effect.as(null)),
                onSuccess: Effect.succeed,
              })
            )

    if (coverLetterSaved !== null) {
      const reviewToken = yield* DurableDeferred.token(
        preparationApprovalDeferred('cover_letter')
      )
      yield* progress.reviewReady(
        input.jobId,
        'cover_letter',
        prepared.application.id,
        coverLetterSaved,
        reviewToken
      )
    }

    const coverLetterResult =
      coverLetterInput === null
        ? null
        : coverLetterSaved === null
          ? ({
              kind: 'cover_letter',
              revisionId: null,
              status: 'failed',
            } satisfies PreparationArtifactWorkflowResult)
          : yield* reviewSavedArtifact(coverLetterInput, coverLetterSaved).pipe(
              Effect.catch((error) =>
                progress
                  .failArtifact(input.jobId, 'cover_letter', error.message)
                  .pipe(
                    Effect.as({
                      kind: 'cover_letter' as const,
                      revisionId: null,
                      status: 'failed' as const,
                    })
                  )
              )
            )

    const artifacts = [
      ...(cvResult === null ? [] : [cvResult]),
      ...(coverLetterResult === null ? [] : [coverLetterResult]),
    ]
    const successCount = artifacts.filter(
      ({ status }) => status === 'approved'
    ).length
    const failureCount = artifacts.filter(
      ({ status }) => status === 'failed'
    ).length
    return {
      applicationId: prepared.application.id,
      artifacts,
      jobId: input.jobId,
      status:
        failureCount === 0
          ? ('completed' as const)
          : successCount === 0
            ? ('failed' as const)
            : ('mixed' as const),
    }
  },
  (effect, payload) =>
    Effect.gen(function* () {
      const input = payload
      const progress = yield* PreparationProgress
      const instance = yield* WorkflowEngine.WorkflowInstance
      return yield* effect.pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) return Effect.void
          if (Cause.hasInterruptsOnly(exit.cause)) {
            if (instance.suspended && !instance.interrupted) {
              return Effect.void
            }
            return progress.cancelJob(input.jobId)
          }
          return progress.failJob(input.jobId, Cause.pretty(exit.cause))
        })
      )
    })
)

export const preparationWorkflowLayer =
  PrepareApplicationWorkflow.toLayer(executePreparation)
