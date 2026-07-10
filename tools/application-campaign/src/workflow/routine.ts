import { Effect } from 'effect'
import type {
  PrepareCampaignOptions,
  PrepareCampaignTarget,
} from '../config/model'
import { logInfo, logWarning, urlHost, withTelemetrySpan } from '../telemetry'

export type CampaignIssue = {
  readonly message: string
  readonly severity: 'error' | 'warning'
  readonly step: string
  readonly targetUrl?: string
}

export type ReadyRoutineStep<Config = void> = {
  readonly config: Config
  readonly dependsOn: readonly string[]
  readonly id: string
  readonly issues: readonly CampaignIssue[]
  readonly label: string
  readonly status: 'ready'
}

export type SkippedRoutineStep = {
  readonly dependsOn: readonly string[]
  readonly id: string
  readonly issues: readonly CampaignIssue[]
  readonly label: string
  readonly reason: string
  readonly status: 'skipped'
}

export type RoutineStep<Config = void> =
  | ReadyRoutineStep<Config>
  | SkippedRoutineStep

export type CampaignTargetRoutine = {
  readonly issues: readonly CampaignIssue[]
  readonly privateLink: RoutineStep<{ readonly webBaseUrl: URL }>
  readonly privatePdf: RoutineStep<{ readonly webBaseUrl: URL }>
  readonly steps: readonly RoutineStep<unknown>[]
  readonly target: PrepareCampaignTarget
  readonly writeArtifacts: ReadyRoutineStep
}

export type CampaignRoutine = {
  readonly issues: readonly CampaignIssue[]
  readonly steps: readonly RoutineStep<unknown>[]
  readonly targets: readonly CampaignTargetRoutine[]
}

const stepId = (target: PrepareCampaignTarget, name: string) =>
  `target:${target.index}:${name}`

const ready = <Config>({
  config,
  dependsOn = [],
  id,
  label,
}: {
  readonly config: Config
  readonly dependsOn?: readonly string[]
  readonly id: string
  readonly label: string
}): ReadyRoutineStep<Config> => ({
  config,
  dependsOn,
  id,
  issues: [],
  label,
  status: 'ready',
})

const skipped = ({
  dependsOn = [],
  id,
  issues = [],
  label,
  reason,
}: {
  readonly dependsOn?: readonly string[]
  readonly id: string
  readonly issues?: readonly CampaignIssue[]
  readonly label: string
  readonly reason: string
}): SkippedRoutineStep => ({
  dependsOn,
  id,
  issues,
  label,
  reason,
  status: 'skipped',
})

const resolvePrivateLink = (
  options: PrepareCampaignOptions,
  target: PrepareCampaignTarget,
  recommendationStep: string
): CampaignTargetRoutine['privateLink'] => {
  const id = stepId(target, 'private-link')

  if (!options.generate) {
    return skipped({
      dependsOn: [recommendationStep],
      id,
      label: 'Mint private CV link',
      reason: 'Private asset generation is disabled.',
    })
  }

  if (!options.webBaseUrl) {
    const issue = {
      message:
        'Private link and PDF generation skipped because no web base URL resolved. Pass --base-url or set APPLICATION_CAMPAIGN_BASE_URL, CV_WEB_BASE_URL, PUBLIC_CV_WEB_BASE_URL, or CV_WEB_HOST.',
      severity: 'warning' as const,
      step: id,
      targetUrl: target.url.href,
    }

    return skipped({
      dependsOn: [recommendationStep],
      id,
      issues: [issue],
      label: 'Mint private CV link',
      reason: issue.message,
    })
  }

  return ready({
    config: { webBaseUrl: options.webBaseUrl },
    dependsOn: [recommendationStep],
    id,
    label: 'Mint private CV link',
  })
}

const resolvePrivatePdf = (
  options: PrepareCampaignOptions,
  target: PrepareCampaignTarget,
  privateLink: CampaignTargetRoutine['privateLink']
): CampaignTargetRoutine['privatePdf'] => {
  const id = stepId(target, 'private-pdf')

  if (privateLink.status === 'skipped') {
    return skipped({
      dependsOn: [privateLink.id],
      id,
      label: 'Export private PDF',
      reason: 'The private link dependency is unavailable.',
    })
  }

  if (options.skipPdf) {
    return skipped({
      dependsOn: [privateLink.id],
      id,
      label: 'Export private PDF',
      reason: 'Private PDF export is disabled.',
    })
  }

  return ready({
    config: privateLink.config,
    dependsOn: [privateLink.id],
    id,
    label: 'Export private PDF',
  })
}

const resolveTargetRoutine = (
  options: PrepareCampaignOptions,
  target: PrepareCampaignTarget
): CampaignTargetRoutine => {
  const fetchJob = ready({
    config: undefined,
    id: stepId(target, 'fetch-job'),
    label: 'Fetch job posting',
  })
  const recommend = ready({
    config: { materials: options.materials },
    dependsOn: ['profiles', fetchJob.id],
    id: stepId(target, 'recommend'),
    label: 'Analyze job and prepare recommendation',
  })
  const privateLink = resolvePrivateLink(options, target, recommend.id)
  const privatePdf = resolvePrivatePdf(options, target, privateLink)
  const writeArtifacts = ready({
    config: undefined,
    dependsOn: [
      recommend.id,
      ...(privateLink.status === 'ready' ? [privateLink.id] : []),
      ...(privatePdf.status === 'ready' ? [privatePdf.id] : []),
    ],
    id: stepId(target, 'write-artifacts'),
    label: 'Write campaign artifacts',
  })
  const steps: readonly RoutineStep<unknown>[] = [
    fetchJob,
    recommend,
    privateLink,
    privatePdf,
    writeArtifacts,
  ]

  return {
    issues: steps.flatMap((step) => step.issues),
    privateLink,
    privatePdf,
    steps,
    target,
    writeArtifacts,
  }
}

export const resolveCampaignRoutine = (options: PrepareCampaignOptions) =>
  Effect.gen(function* () {
    const profiles = ready({
      config: undefined,
      id: 'profiles',
      label: 'Discover and render CV profiles',
    })
    const targets = options.targets.map((target) =>
      resolveTargetRoutine(options, target)
    )
    const steps: readonly RoutineStep<unknown>[] = [
      profiles,
      ...targets.flatMap((target) => target.steps),
    ]
    const issues = targets.flatMap((target) => target.issues)

    yield* logInfo('Resolved application campaign routine', {
      readyStepCount: steps.filter((step) => step.status === 'ready').length,
      skippedStepCount: steps.filter((step) => step.status === 'skipped')
        .length,
      targetCount: targets.length,
      warningCount: issues.length,
    })

    yield* Effect.forEach(
      issues,
      (issue) =>
        logWarning(issue.message, {
          jobHost: issue.targetUrl ? urlHost(issue.targetUrl) : undefined,
          step: issue.step,
        }),
      { discard: true }
    )

    return { issues, steps, targets } satisfies CampaignRoutine
  }).pipe(
    withTelemetrySpan('application-campaign.routine.resolve', {
      targetCount: options.targets.length,
    })
  )
