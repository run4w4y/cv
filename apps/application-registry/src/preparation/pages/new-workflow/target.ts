import type { AiWorkflowTarget } from '@cv/application-preparation-workflow/domain'
import type { Application } from '@cv/application-registry-entity'

export const existingApplicationWorkflowTarget = (
  application: Pick<Application, 'id' | 'postingUrl'>,
  context: {
    readonly factsReleaseId: string
    readonly jobSnapshot: { readonly id: string }
  }
): AiWorkflowTarget => ({
  _tag: 'ExistingApplication',
  applicationId: application.id,
  factsReleaseId: context.factsReleaseId,
  jobSnapshotId: context.jobSnapshot.id,
  url: application.postingUrl,
})
