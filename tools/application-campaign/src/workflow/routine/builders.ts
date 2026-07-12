import type {
  CampaignIssue,
  ReadyRoutineStep,
  SkippedRoutineStep,
} from './types'

export type ReadyRoutineStepInput<Config> = {
  readonly config: Config
  readonly dependsOn?: readonly string[]
  readonly id: string
  readonly label: string
}

export const readyRoutineStep = <Config>({
  config,
  dependsOn = [],
  id,
  label,
}: ReadyRoutineStepInput<Config>): ReadyRoutineStep<Config> => ({
  config,
  dependsOn,
  id,
  issues: [],
  label,
  status: 'ready',
})

export type SkippedRoutineStepInput = {
  readonly dependsOn?: readonly string[]
  readonly id: string
  readonly issues?: readonly CampaignIssue[]
  readonly label: string
  readonly reason: string
}

export const skippedRoutineStep = ({
  dependsOn = [],
  id,
  issues = [],
  label,
  reason,
}: SkippedRoutineStepInput): SkippedRoutineStep => ({
  dependsOn,
  id,
  issues,
  label,
  reason,
  status: 'skipped',
})
