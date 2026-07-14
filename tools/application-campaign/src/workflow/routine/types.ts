import type {
  PrepareCampaignOptions,
  PrepareCampaignTarget,
} from '../../config/model'

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
  readonly fetchJob: ReadyRoutineStep
  readonly issues: readonly CampaignIssue[]
  readonly privateLink: RoutineStep<{ readonly webBaseUrl: URL }>
  readonly privatePdf: RoutineStep<{ readonly webBaseUrl: URL }>
  readonly recommend: ReadyRoutineStep<{
    readonly materials: PrepareCampaignOptions['materials']
  }>
  readonly steps: readonly RoutineStep<unknown>[]
  readonly target: PrepareCampaignTarget
  readonly writeArtifacts: ReadyRoutineStep
}

export type CampaignRoutine = {
  readonly buildPdfAssets: RoutineStep<{ readonly webBaseUrl?: URL }>
  readonly issues: readonly CampaignIssue[]
  readonly pluginSteps: readonly ReadyRoutineStep[]
  readonly profiles: ReadyRoutineStep
  readonly runArtifacts: ReadyRoutineStep
  readonly steps: readonly RoutineStep<unknown>[]
  readonly targetsStep: ReadyRoutineStep
  readonly targets: readonly CampaignTargetRoutine[]
}
