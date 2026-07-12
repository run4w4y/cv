import { Effect } from 'effect'
import type {
  WorkflowFailurePolicy,
  WorkflowStep,
} from '../../../workflow/graph/types'
import type { ApplicationRegistryCampaignClient } from './client'

export const applicationRegistrySyncStepId = 'application-registry.sync'

export type MakeRegistrySyncStepInput = {
  readonly client: ApplicationRegistryCampaignClient
  readonly failurePolicy: Extract<WorkflowFailurePolicy, 'fail-run' | 'warn'>
}

export const makeRegistrySyncStep = ({
  client,
  failurePolicy,
}: MakeRegistrySyncStepInput): WorkflowStep => ({
  execute: () =>
    client.sync().pipe(
      Effect.tap((result) =>
        result.failed.length > 0
          ? Effect.logWarning(
              `Application registry outbox replay left ${result.failed.length} command(s) pending.`
            )
          : result.synced > 0
            ? Effect.logInfo(
                `Application registry synchronized ${result.synced} queued command(s).`
              )
            : Effect.void
      ),
      Effect.as([])
    ),
  failurePolicy,
  id: applicationRegistrySyncStepId,
  label: 'Synchronize application registry outbox',
  scope: 'run',
})
