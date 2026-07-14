import { intro, log, outro, taskLog } from '@clack/prompts'
import { Clock, Effect, Semaphore } from 'effect'
import type {
  CampaignProgressEvent,
  CampaignReporterService,
} from '../workflow/progress'
import type { CampaignRoutine, RoutineStep } from '../workflow/routine'
import type {
  PreparedCampaignResult,
  PreparedCampaignRun,
} from '../workflow/types'

export const campaignOutputModes = ['auto', 'pretty', 'plain'] as const
export type CampaignOutputMode = (typeof campaignOutputModes)[number]
export type ResolvedCampaignOutputMode = Exclude<CampaignOutputMode, 'auto'>

type StepStatus = 'failed' | 'pending' | 'running' | 'skipped' | 'succeeded'
type StepProgress = { detail?: string; status: StepStatus }
type TaskLogController = ReturnType<typeof taskLog>

type PresentationState = {
  concurrency: number
  definitions: Map<string, RoutineStep<unknown>>
  finished: boolean
  routine?: CampaignRoutine
  startedAt: number
  steps: Map<string, StepProgress>
  targetByStep: Map<string, number>
  targetLabels: Map<number, string>
}

export type CampaignPresenter = {
  readonly mode: ResolvedCampaignOutputMode
  readonly reporter: CampaignReporterService
}

const makeState = (startedAt: number): PresentationState => ({
  concurrency: 1,
  definitions: new Map(),
  finished: false,
  startedAt,
  steps: new Map(),
  targetByStep: new Map(),
  targetLabels: new Map(),
})

const initializeRoutine = (
  state: PresentationState,
  routine: CampaignRoutine
) => {
  state.routine = routine
  state.definitions.clear()
  state.steps.clear()
  state.targetByStep.clear()

  for (const target of routine.targets) {
    for (const step of target.steps) {
      state.targetByStep.set(step.id, target.target.index)
    }
  }

  for (const step of routine.steps) {
    state.definitions.set(step.id, step)
    state.steps.set(step.id, {
      status: step.status === 'skipped' ? 'skipped' : 'pending',
    })
  }
}

const updateStep = (
  state: PresentationState,
  stepId: string,
  update: (progress: StepProgress) => StepProgress
) => {
  const progress = state.steps.get(stepId)
  if (progress) {
    state.steps.set(stepId, update(progress))
  }
}

const applyEvent = (
  state: PresentationState,
  event: CampaignProgressEvent,
  now: number
) => {
  switch (event._tag) {
    case 'RunStarted':
      state.concurrency = event.concurrency
      state.startedAt = now
      return
    case 'RoutineResolved':
      initializeRoutine(state, event.routine)
      return
    case 'StepStarted':
      updateStep(state, event.stepId, () => ({ status: 'running' }))
      return
    case 'StepDetail':
      updateStep(state, event.stepId, () => ({
        detail: event.message,
        status: 'running',
      }))
      return
    case 'StepSucceeded':
      updateStep(state, event.stepId, () => ({ status: 'succeeded' }))
      return
    case 'StepFailed':
      updateStep(state, event.stepId, () => ({
        detail: event.message,
        status: 'failed',
      }))
      return
    case 'StepSkipped':
      updateStep(state, event.stepId, (progress) =>
        progress.status === 'failed' || progress.status === 'succeeded'
          ? progress
          : { detail: event.reason, status: 'skipped' }
      )
      return
    case 'TargetIdentified':
      state.targetLabels.set(
        event.targetIndex,
        `${event.company} | ${event.role}`
      )
      return
    case 'TargetFailed':
      for (const [stepId, targetIndex] of state.targetByStep) {
        if (targetIndex !== event.targetIndex) {
          continue
        }
        updateStep(state, stepId, (progress) =>
          progress.status === 'pending'
            ? { detail: event.reason, status: 'skipped' }
            : progress
        )
      }
      return
    case 'RunFinished':
      state.finished = true
  }
}

export const resolveCampaignOutputMode = ({
  diagnosticLogs = false,
  isCi = Boolean(process.env.CI && process.env.CI !== 'false'),
  isTty = process.stderr.isTTY === true,
  requested,
}: {
  readonly diagnosticLogs?: boolean
  readonly isCi?: boolean
  readonly isTty?: boolean
  readonly requested: CampaignOutputMode
}): ResolvedCampaignOutputMode => {
  if (diagnosticLogs) {
    return 'plain'
  }
  if (requested !== 'auto') {
    return requested
  }
  return isTty && !isCi ? 'pretty' : 'plain'
}

const targetUrlLabel = (url: URL) =>
  `${url.host}${url.pathname === '/' ? '' : url.pathname}`

const planStep = (step: RoutineStep<unknown>, indent: string) =>
  step.status === 'ready'
    ? `${indent}[ ] ${step.label}`
    : `${indent}[-] ${step.label}: ${step.reason}`

export const formatCampaignPlan = (routine: CampaignRoutine) => {
  const ready = routine.steps.filter((step) => step.status === 'ready').length
  const lines = [
    `Plan (${ready} runnable, ${routine.steps.length - ready} skipped)`,
    ...routine.pluginSteps.map((step) => planStep(step, '  ')),
    planStep(routine.profiles, '  '),
    planStep(routine.buildPdfAssets, '  '),
    planStep(routine.targetsStep, '  '),
  ]

  for (const target of routine.targets) {
    lines.push(`  + ${targetUrlLabel(target.target.url)}`)
    lines.push(...target.steps.map((step) => planStep(step, '    ')))
  }

  lines.push(planStep(routine.runArtifacts, '  '))
  return lines.join('\n')
}

const isTerminal = (status: StepStatus) =>
  status === 'failed' || status === 'skipped' || status === 'succeeded'

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const progressStatus = (state: PresentationState, now: number) => {
  const runnable = [...state.definitions.values()].filter(
    (step) => step.status === 'ready'
  )
  const progress = runnable.flatMap((step) => {
    const value = state.steps.get(step.id)
    return value ? [value] : []
  })
  const completed = progress.filter((step) => isTerminal(step.status)).length
  const running = progress.filter((step) => step.status === 'running').length
  const skipped = [...state.steps.values()].filter(
    (step) => step.status === 'skipped'
  ).length
  const failed = progress.filter((step) => step.status === 'failed').length
  const width = Math.max(10, Math.min(24, (process.stderr.columns ?? 80) - 55))
  const filled = Math.floor((completed / Math.max(1, runnable.length)) * width)
  const failures = failed > 0 ? ` | ${failed} failed` : ''

  return `[${'='.repeat(filled)}${'-'.repeat(width - filled)}] ${completed}/${runnable.length} | ${running} running | ${skipped} skipped${failures} | ${formatDuration(now - state.startedAt)}`
}

const targetLabel = (state: PresentationState, targetIndex: number) => {
  const routine = state.routine
  if (!routine) {
    return `Target ${targetIndex + 1}`
  }
  const target = routine.targets.find(
    (candidate) => candidate.target.index === targetIndex
  )
  return (
    state.targetLabels.get(targetIndex) ??
    (target ? targetUrlLabel(target.target.url) : `Target ${targetIndex + 1}`)
  )
}

const activeStatus = (state: PresentationState) => {
  const activities = [...state.steps.entries()].flatMap(
    ([stepId, progress]) => {
      if (progress.status !== 'running') {
        return []
      }

      const definition = state.definitions.get(stepId)
      const targetIndex = state.targetByStep.get(stepId)
      const owner =
        targetIndex !== undefined
          ? targetLabel(state, targetIndex)
          : stepId === state.routine?.runArtifacts.id
            ? 'Run output'
            : stepId === state.routine?.targetsStep.id
              ? 'Campaign targets'
              : 'Shared profiles'
      return [`${owner}: ${progress.detail ?? definition?.label ?? stepId}`]
    }
  )

  if (activities.length === 0) {
    return 'Waiting for the next stage'
  }

  const visible = activities.slice(0, 3)
  const remainder = activities.length - visible.length
  return `Active: ${visible.join(' | ')}${remainder > 0 ? ` | +${remainder} more` : ''}`
}

const liveStatus = (state: PresentationState, now: number) =>
  `${progressStatus(state, now)}\n${activeStatus(state)}`

const makePrettyReporter = Effect.gen(function* () {
  const state = makeState(yield* Clock.currentTimeMillis)
  const semaphore = yield* Semaphore.make(1)
  let live: TaskLogController | undefined

  const startDisplay = (routine: CampaignRoutine, now: number) => {
    log.info(
      `${routine.targets.length} target${routine.targets.length === 1 ? '' : 's'} | concurrency ${state.concurrency}`,
      { output: process.stderr }
    )
    log.message(formatCampaignPlan(routine), { output: process.stderr })

    live = taskLog({
      limit: 2,
      output: process.stderr,
      retainLog: false,
      title: 'Running application campaign',
    })
    live.message(liveStatus(state, now))
  }

  const render = (event: CampaignProgressEvent, now: number) => {
    if (event._tag === 'RunStarted') {
      intro('Application campaign', { output: process.stderr })
      return
    }
    if (event._tag === 'RoutineResolved') {
      startDisplay(event.routine, now)
      return
    }
    if (!live) {
      return
    }

    live.message(liveStatus(state, now))

    if (event._tag === 'RunFinished') {
      const warnings =
        event.warningCount > 0
          ? ` with ${event.warningCount} warning${event.warningCount === 1 ? '' : 's'}`
          : ''
      const message = `Application campaign ${event.status}${warnings} in ${formatDuration(now - state.startedAt)}`
      if (event.status === 'succeeded' && event.errorCount === 0) {
        live.success(message, { showLog: false })
      } else {
        live.error(message, { showLog: true })
      }
      live = undefined
    }
  }

  const reporter: CampaignReporterService = {
    report: (event) =>
      semaphore.withPermit(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          yield* Effect.sync(() => {
            applyEvent(state, event, now)
            render(event, now)
          })
        })
      ),
  }

  yield* Effect.sleep('1 second').pipe(
    Effect.andThen(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        yield* semaphore.withPermit(
          Effect.sync(() => {
            if (live && !state.finished) {
              live.message(liveStatus(state, now))
            }
          })
        )
      })
    ),
    Effect.forever,
    Effect.forkScoped
  )
  yield* Effect.addFinalizer(() =>
    semaphore.withPermit(
      Effect.sync(() => {
        if (live && !state.finished) {
          live.error('Application campaign stopped before completion', {
            showLog: true,
          })
          live = undefined
        }
      })
    )
  )

  return reporter
})

const writeErrorLine = (line: string) => {
  process.stderr.write(`${line}\n`)
}

const makePlainReporter = Effect.gen(function* () {
  const state = makeState(yield* Clock.currentTimeMillis)
  const semaphore = yield* Semaphore.make(1)
  const reporter: CampaignReporterService = {
    report: (event) =>
      semaphore.withPermit(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          yield* Effect.sync(() => {
            applyEvent(state, event, now)
            const label =
              'stepId' in event
                ? (state.definitions.get(event.stepId)?.label ?? event.stepId)
                : undefined

            switch (event._tag) {
              case 'RunStarted':
                writeErrorLine(
                  `Application campaign: ${event.targetCount} target${event.targetCount === 1 ? '' : 's'}, concurrency ${event.concurrency}`
                )
                return
              case 'RoutineResolved':
                writeErrorLine(formatCampaignPlan(event.routine))
                return
              case 'StepStarted':
                writeErrorLine(`[start] ${label}`)
                return
              case 'StepDetail':
                writeErrorLine(`[work] ${label}: ${event.message}`)
                return
              case 'StepSucceeded':
                writeErrorLine(`[done] ${label}`)
                return
              case 'StepFailed':
                writeErrorLine(`[failed] ${label}: ${event.message}`)
                return
              case 'StepSkipped':
                writeErrorLine(`[skipped] ${label}: ${event.reason}`)
                return
              case 'TargetIdentified':
                writeErrorLine(`[target] ${event.company} | ${event.role}`)
                return
              case 'TargetFailed':
                writeErrorLine(
                  `[skipped] Remaining stages for ${targetLabel(state, event.targetIndex)}`
                )
                return
              case 'RunFinished':
                writeErrorLine(
                  `[complete] ${event.status} in ${formatDuration(now - state.startedAt)} | ${event.warningCount} warnings | ${event.errorCount} errors`
                )
            }
          })
        })
      ),
  }
  return reporter
})

export const makeCampaignPresenter = ({
  diagnosticLogs,
  outputMode,
}: {
  readonly diagnosticLogs: boolean
  readonly outputMode: CampaignOutputMode
}) =>
  Effect.gen(function* () {
    const mode = resolveCampaignOutputMode({
      diagnosticLogs,
      requested: outputMode,
    })
    const reporter =
      mode === 'pretty' ? yield* makePrettyReporter : yield* makePlainReporter
    return { mode, reporter } satisfies CampaignPresenter
  })

const resultLabel = (campaign: PreparedCampaignResult) =>
  campaign.status === 'failed'
    ? targetUrlLabel(campaign.target.url)
    : `${campaign.recommendation.job.company} | ${campaign.recommendation.job.role}`

const resultLines = (campaign: PreparedCampaignResult) => {
  if (campaign.status === 'failed') {
    return [
      `${resultLabel(campaign)}: failed`,
      `  Error: ${campaign.error}`,
      `  Output: ${campaign.outDir}`,
    ]
  }
  return [
    `${resultLabel(campaign)}: ${campaign.status}`,
    `  Profile: ${campaign.decisions.profile}`,
    `  Audience: ${campaign.decisions.audience}`,
    `  Output: ${campaign.outDir}`,
    ...(campaign.generated.link
      ? [`  Private link: ${campaign.generated.link.url}`]
      : []),
    ...(campaign.generated.pdfPath
      ? [`  PDF: ${campaign.generated.pdfPath}`]
      : []),
  ]
}

const printPlainResult = (result: PreparedCampaignRun) =>
  Effect.sync(() => {
    process.stdout.write(`Application campaign ${result.status}\n`)
    for (const campaign of result.campaigns) {
      process.stdout.write(`${resultLines(campaign).join('\n')}\n`)
    }
    for (const issue of result.issues) {
      process.stdout.write(
        `${issue.severity === 'warning' ? 'Warning' : 'Error'}: ${issue.message}\n`
      )
    }
    process.stdout.write(`Run output: ${result.outDir}\n`)
  })

const printPrettyResult = (result: PreparedCampaignRun) =>
  Effect.sync(() => {
    const message = `Application campaign ${result.status}`
    if (result.status === 'succeeded') {
      log.success(message, { output: process.stdout })
    } else if (result.status === 'partial') {
      log.warn(message, { output: process.stdout })
    } else {
      log.error(message, { output: process.stdout })
    }

    for (const campaign of result.campaigns) {
      log.message(resultLines(campaign), { output: process.stdout })
    }
    for (const issue of result.issues) {
      const options = { output: process.stdout }
      issue.severity === 'warning'
        ? log.warn(issue.message, options)
        : log.error(issue.message, options)
    }
    outro(`Run output: ${result.outDir}`, { output: process.stdout })
  })

export const printCampaignResult = (
  result: PreparedCampaignRun,
  mode: ResolvedCampaignOutputMode
) => (mode === 'pretty' ? printPrettyResult(result) : printPlainResult(result))
