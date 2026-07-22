import { Alert, AlertDescription, AlertTitle, Button } from '@cv/internal-ui'
import { CircleAlert, Sparkles } from 'lucide-react'

import type {
  CoverLetterPageController,
  CoverLetterWorkspace,
} from './use-page-controller'

export const CoverLetterWorkflowFeedback = ({
  page,
  workspace,
}: {
  readonly page: CoverLetterPageController
  readonly workspace: CoverLetterWorkspace
}) => {
  const run = workspace.run
  const detached = workspace.editor.workflowCandidate

  return (
    <>
      {run === null ? null : (
        <Alert>
          <Sparkles />
          <AlertTitle>Workflow {run.status.replace('_', ' ')}</AlertTitle>
          <AlertDescription className="grid gap-1">
            <span>{run.message}</span>
            {run.candidate === null ? null : (
              <span>
                Candidate revision{' '}
                {run.candidate.result.revision.revisionNumber} was persisted
                from snapshot {run.candidate.result.revision.jobSnapshotId} and
                facts {run.candidate.result.revision.factsReleaseId} before
                review · {run.candidate.candidate.metadata.length} Codex calls
                retained with usage metadata for this session.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {detached._tag !== 'Detached' ? null : (
        <Alert>
          <CircleAlert />
          <AlertTitle>No live Workflow review is attached</AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>
              Candidate revision {detached.candidateRevisionId} is still
              persisted, but its in-memory Workflow review is no longer live or
              was lost during a runtime refresh. Direct approval stays blocked
              until you explicitly release the Workflow review gate for this
              unchanged saved revision.
            </span>
            <Button
              className="w-fit"
              variant="outline"
              disabled={page.actionPending || page.workflowExecuting}
              onClick={page.adoptDetachedCandidate}
            >
              Allow direct approval
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {page.workflowBindingError === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Revision is outside this Workflow review</AlertTitle>
          <AlertDescription>{page.workflowBindingError}</AlertDescription>
        </Alert>
      )}
    </>
  )
}
