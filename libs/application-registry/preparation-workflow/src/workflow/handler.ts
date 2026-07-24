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
  candidateMatchesDocumentKind,
  type EvidencePlan,
  EvidencePlanResultSchema,
  type GeneratedCandidate,
  GeneratedCandidateSchema,
  type JobAnalysis,
  JobAnalysisResultSchema,
  normalizePreparationJobInput,
  type PreparationArtifactWorkflowResult,
  type PreparationBootstrap,
  PreparationBootstrapSchema,
  PreparationWorkflowError,
  type PreparationWorkflowInput,
  type PreparationWorkflowPayload,
  PrepareApplicationWorkflow,
  preparationJobArtifactInput,
  preparationJobArtifactInputs,
  preparationReviewDeferred,
  preparationSourceApplicationId,
  SavedCandidateSchema,
  SectionBriefResultSchema,
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
    const input = normalizePreparationJobInput(payload)
    const gateway = yield* PreparationGateway
    const progress = yield* PreparationProgress
    const concurrency = yield* PreparationConcurrency
    const artifactInputs = preparationJobArtifactInputs(input)
    const cvInput = preparationJobArtifactInput(input, 'cv')
    const coverLetterInput = preparationJobArtifactInput(input, 'cover_letter')
    const primaryInput = cvInput ?? coverLetterInput
    if (primaryInput === null) {
      return yield* Effect.die(
        'Decoded preparation job did not contain an artifact input.'
      )
    }

    const stageArtifacts = (
      stage: Parameters<typeof progress.stage>[1],
      message: string,
      applicationId?: string
    ) =>
      Effect.forEach(
        artifactInputs,
        ({ runId }) => progress.stage(runId, stage, message, applicationId),
        { discard: true }
      )

    const prepareArtifact = Effect.fn('PrepareApplication.prepareArtifact')(
      function* (
        artifactInput: PreparationWorkflowInput,
        context: PreparationBootstrap,
        analysis: JobAnalysis,
        evidence: EvidencePlan
      ) {
        const { kind, runId } = artifactInput
        yield* progress.stage(
          runId,
          'briefs',
          'Building section briefs with bounded parallel generation calls.'
        )
        const briefs = yield* Effect.forEach(
          gateway.sectionIds(kind),
          (sectionId) =>
            Activity.make({
              name: `${kind}/section-brief/${sectionId}`,
              success: SectionBriefResultSchema,
              error: PreparationWorkflowError,
              interruptRetryPolicy: stopActivityInterruptRetries,
              execute: withActivityTimeout(
                'briefs',
                '2 minutes',
                gateway.brief(
                  artifactInput,
                  context,
                  analysis,
                  evidence,
                  sectionId
                )
              ),
            }),
          { concurrency: 2 }
        )

        yield* progress.stage(
          runId,
          'composition',
          'Composing one coherent final document from the plan.'
        )
        const composed = yield* Activity.make({
          name: `${kind}/compose-document`,
          success: GeneratedCandidateSchema,
          error: PreparationWorkflowError,
          interruptRetryPolicy: stopActivityInterruptRetries,
          execute: withActivityTimeout(
            'composition',
            '3 minutes',
            gateway.compose(
              artifactInput,
              context,
              analysis,
              evidence,
              briefs.map(({ brief }) => brief)
            )
          ),
        })
        const candidate: GeneratedCandidate = {
          ...composed,
          metadata: [
            ...briefs.map(({ metadata }) => metadata),
            ...composed.metadata,
          ],
        }

        yield* progress.stage(
          runId,
          'validation',
          'Validating the generated document and its requested format.'
        )
        if (!candidateMatchesDocumentKind(candidate, kind)) {
          return yield* Effect.fail(
            new PreparationWorkflowError({
              message: `Generated ${candidate._tag} candidate did not match requested document kind ${kind}.`,
              stage: 'validation',
            })
          )
        }

        yield* progress.stage(
          runId,
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
      }
    )

    // One permit represents one URL job. Shared analysis and evidence selection
    // happen once; document-specific generation remains independently visible.
    const generated = yield* concurrency.withJobSlot(
      Effect.gen(function* () {
        yield* stageArtifacts(
          'application',
          preparationSourceApplicationId(input.source) === null
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
        yield* stageArtifacts(
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
        yield* stageArtifacts(
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
        const context = {
          ...initialContext,
          application,
        }

        yield* stageArtifacts(
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
            : yield* prepareArtifact(
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
                    yield* progress.fail(cvInput.runId, error.message)
                    if (coverLetterInput !== null) {
                      yield* progress.fail(
                        coverLetterInput.runId,
                        'Cover-letter generation was blocked because the tailored CV failed.'
                      )
                    }
                  })
                )
              )

        if (cvSaved !== null) {
          const reviewToken = yield* DurableDeferred.token(
            preparationReviewDeferred('cv')
          )
          yield* progress.reviewReady(
            cvInput?.runId ?? input.jobId,
            cvSaved.application.id,
            cvSaved,
            reviewToken
          )
        }

        const prepareCoverLetter =
          coverLetterInput === null
            ? null
            : Effect.gen(function* () {
                const letterContext =
                  cvSaved === null
                    ? context
                    : yield* Activity.make({
                        name: 'cover_letter/load-context',
                        success: PreparationBootstrapSchema,
                        error: PreparationWorkflowError,
                        interruptRetryPolicy: stopActivityInterruptRetries,
                        execute: withActivityTimeout(
                          'capture',
                          '30 seconds',
                          gateway
                            .bootstrap(
                              {
                                ...coverLetterInput,
                                source: {
                                  _tag: 'ReviewedContext',
                                  applicationId: application.id,
                                  factsReleaseId: context.factsReleaseId,
                                  jobSnapshotId: context.jobSnapshot.id,
                                  url: input.source.url,
                                },
                              },
                              application
                            )
                            .pipe(
                              Effect.map((loaded) => ({
                                ...loaded,
                                application,
                                referenceCv:
                                  cvSaved.candidate._tag === 'Cv'
                                    ? cvSaved.candidate.document
                                    : null,
                                referenceCvRevisionId:
                                  cvSaved.result.revision.id,
                              }))
                            )
                        ),
                      })
                const saved = yield* prepareArtifact(
                  coverLetterInput,
                  letterContext,
                  analysis.analysis,
                  evidence.plan
                )
                return {
                  ...saved,
                  candidate: {
                    ...saved.candidate,
                    metadata: [...sharedMetadata, ...saved.candidate.metadata],
                  },
                }
              })

        const coverLetterResult =
          prepareCoverLetter === null
            ? null
            : cvInput === null
              ? yield* prepareCoverLetter
              : yield* prepareCoverLetter.pipe(
                  Effect.matchEffect({
                    onFailure: (error) =>
                      progress
                        .fail(
                          coverLetterInput?.runId ?? input.jobId,
                          error.message
                        )
                        .pipe(Effect.as(null)),
                    onSuccess: Effect.succeed,
                  })
                )

        if (coverLetterResult !== null) {
          const reviewToken = yield* DurableDeferred.token(
            preparationReviewDeferred('cover_letter')
          )
          yield* progress.reviewReady(
            coverLetterInput?.runId ?? input.jobId,
            coverLetterResult.application.id,
            coverLetterResult,
            reviewToken
          )
        }

        return {
          applicationId: application.id,
          failed:
            coverLetterInput !== null && coverLetterResult === null
              ? ([
                  {
                    kind: 'cover_letter',
                    revisionId: null,
                    runId: coverLetterInput.runId,
                    status: 'failed',
                  },
                ] satisfies ReadonlyArray<PreparationArtifactWorkflowResult>)
              : [],
          ready: [
            ...(cvInput === null || cvSaved === null
              ? []
              : [{ input: cvInput, saved: cvSaved }]),
            ...(coverLetterInput === null || coverLetterResult === null
              ? []
              : [{ input: coverLetterInput, saved: coverLetterResult }]),
          ],
        }
      })
    )

    const reviewed = yield* Effect.forEach(
      generated.ready,
      ({ input: artifactInput, saved }) =>
        Effect.gen(function* () {
          const decision = yield* DurableDeferred.await(
            preparationReviewDeferred(artifactInput.kind)
          )

          if (decision._tag === 'Approved') {
            const approved = yield* Activity.make({
              name: `${artifactInput.kind}/approve-bound-revision`,
              success: ContentRevisionResultSchema,
              error: PreparationWorkflowError,
              interruptRetryPolicy: stopActivityInterruptRetries,
              execute: withActivityTimeout(
                'review',
                '30 seconds',
                gateway.approveBoundRevision(saved, decision.revisionId)
              ),
            })
            yield* progress.complete(artifactInput.runId, {
              message: 'Human review approved the prepared revision.',
              result: approved,
              status: 'approved',
            })
            return {
              kind: artifactInput.kind,
              revisionId: approved.revision.id,
              runId: artifactInput.runId,
              status: 'approved' as const,
            }
          }

          yield* progress.complete(artifactInput.runId, {
            message: `Human review rejected the candidate: ${decision.reason}`,
            status: 'rejected',
          })
          return {
            kind: artifactInput.kind,
            revisionId: null,
            runId: artifactInput.runId,
            status: 'rejected' as const,
          }
        }).pipe(
          Effect.catch((error) =>
            progress.fail(artifactInput.runId, error.message).pipe(
              Effect.as({
                kind: artifactInput.kind,
                revisionId: null,
                runId: artifactInput.runId,
                status: 'failed' as const,
              })
            )
          )
        ),
      { concurrency: 1 }
    )

    const artifacts = [...reviewed, ...generated.failed]
    const onlyArtifact = artifacts.length === 1 ? artifacts[0] : undefined
    return {
      applicationId: generated.applicationId,
      artifacts,
      jobId: input.jobId,
      ...(onlyArtifact === undefined || onlyArtifact.status === 'failed'
        ? {}
        : {
            revisionId: onlyArtifact.revisionId,
            runId: onlyArtifact.runId,
            status: onlyArtifact.status,
          }),
    }
  },
  (effect, payload) =>
    Effect.gen(function* () {
      const input = normalizePreparationJobInput(payload)
      const progress = yield* PreparationProgress
      const instance = yield* WorkflowEngine.WorkflowInstance
      return yield* effect.pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) return Effect.void
          if (Cause.hasInterruptsOnly(exit.cause)) {
            if (instance.suspended && !instance.interrupted) {
              return Effect.void
            }
            return progress.cancel(input.jobId)
          }
          return progress.failJob(input.jobId, Cause.pretty(exit.cause))
        })
      )
    })
)

export const preparationWorkflowLayer =
  PrepareApplicationWorkflow.toLayer(executePreparation)
