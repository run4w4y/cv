import { Cause, Context, Data, Effect, Exit } from 'effect'
import type { CampaignRoutine, ReadyRoutineStep } from './routine'
import type { PreparedCampaignRun } from './types'

export type CampaignProgressEvent = Data.TaggedEnum<{
  RunStarted: {
    readonly concurrency: number
    readonly targetCount: number
  }
  RoutineResolved: {
    readonly routine: CampaignRoutine
  }
  StepStarted: {
    readonly stepId: string
  }
  StepDetail: {
    readonly message: string
    readonly stepId: string
  }
  StepSucceeded: {
    readonly stepId: string
  }
  StepFailed: {
    readonly message: string
    readonly stepId: string
  }
  StepSkipped: {
    readonly reason: string
    readonly stepId: string
  }
  TargetIdentified: {
    readonly company: string
    readonly role: string
    readonly targetIndex: number
  }
  TargetFailed: {
    readonly reason: string
    readonly targetIndex: number
  }
  RunFinished: {
    readonly errorCount: number
    readonly status: PreparedCampaignRun['status']
    readonly warningCount: number
  }
}>

export const CampaignProgressEvent = Data.taggedEnum<CampaignProgressEvent>()

export type CampaignReporterService = {
  readonly report: (event: CampaignProgressEvent) => Effect.Effect<void>
}

const silentReporter: CampaignReporterService = {
  report: () => Effect.void,
}

export const CampaignReporter = Context.Reference<CampaignReporterService>(
  '@cv/application-campaign/CampaignReporter',
  { defaultValue: () => silentReporter }
)

export const reportCampaignProgress = (event: CampaignProgressEvent) =>
  CampaignReporter.use((reporter) => reporter.report(event))

const failureMessage = <E>(cause: Cause.Cause<E>) => {
  if (Cause.hasInterruptsOnly(cause)) {
    return 'Interrupted'
  }

  const failure = Cause.squash(cause)
  return failure instanceof Error ? failure.message : String(failure)
}

const reportStepExit = <A, E>(
  stepIds: readonly string[],
  exit: Exit.Exit<A, E>
) =>
  Effect.forEach(
    stepIds,
    (stepId) =>
      Exit.match(exit, {
        onFailure: (cause) =>
          reportCampaignProgress(
            CampaignProgressEvent.StepFailed({
              message: failureMessage(cause),
              stepId,
            })
          ),
        onSuccess: () =>
          reportCampaignProgress(
            CampaignProgressEvent.StepSucceeded({ stepId })
          ),
      }),
    { discard: true }
  )

export const trackCampaignSteps = <A, E, R>(
  steps: readonly ReadyRoutineStep<unknown>[],
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  const stepIds = steps.map((step) => step.id)

  return Effect.forEach(
    stepIds,
    (stepId) =>
      reportCampaignProgress(CampaignProgressEvent.StepStarted({ stepId })),
    { discard: true }
  ).pipe(
    Effect.andThen(
      effect.pipe(Effect.onExit((exit) => reportStepExit(stepIds, exit)))
    )
  )
}

export const trackCampaignStep = <Config, A, E, R>(
  step: ReadyRoutineStep<Config>,
  effect: Effect.Effect<A, E, R>
) => trackCampaignSteps([step], effect)

export const reportStepDetail = (
  step: ReadyRoutineStep<unknown>,
  message: string
) =>
  reportCampaignProgress(
    CampaignProgressEvent.StepDetail({ message, stepId: step.id })
  )

export const reportStepSkipped = (
  step: ReadyRoutineStep<unknown>,
  reason: string
) =>
  reportCampaignProgress(
    CampaignProgressEvent.StepSkipped({ reason, stepId: step.id })
  )
