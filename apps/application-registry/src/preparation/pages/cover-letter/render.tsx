import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
} from '@cv/internal-ui'
import { CircleAlert, RefreshCw } from 'lucide-react'

import { JobContextEditor } from '@/preparation/components/job-context-editor'
import {
  PreparationPageFrame,
  PreparationSupportingContext,
} from '@/preparation/components/page-frame'
import { CoverLetterEditorCard } from './editor-card'
import { CoverLetterGenerationSettings } from './generation-settings'
import { useCoverLetterPageController } from './use-page-controller'
import { CoverLetterWorkflowFeedback } from './workflow-feedback'

export const CoverLetterPage = () => {
  const page = useCoverLetterPageController()
  const workspace = page.workspaceState

  return (
    <PreparationPageFrame
      applicationId={page.applicationId}
      eyebrow={page.focusedReview ? 'Workflow review' : 'Separate writing flow'}
      title={
        page.focusedReview
          ? 'Review cover-letter candidate'
          : 'Prepare a cover letter'
      }
      description={
        page.focusedReview
          ? 'Inspect the generated letter, make any necessary edits, and approve or reject it before the workflow can continue.'
          : 'Customize the writing instructions, generate from the same job snapshot and reviewed facts, edit the result, and store it as an opaque cover-letter revision.'
      }
    >
      {workspace.status === 'error' ? (
        <>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Preparation context unavailable</AlertTitle>
            <AlertDescription className="grid gap-3">
              <span>{page.actionError ?? workspace.message}</span>
              <Button
                className="w-fit"
                variant="outline"
                disabled={page.snapshotRefreshPending}
                onClick={() => void page.refreshJobSnapshot()}
              >
                <RefreshCw />
                {page.snapshotRefreshPending
                  ? 'Refreshing posting…'
                  : 'Capture posting again'}
              </Button>
            </AlertDescription>
          </Alert>
          {page.focusedReview ? (
            <PreparationSupportingContext description="The workflow candidate is unavailable, but you can still inspect or repair the saved job context.">
              <JobContextEditor applicationId={page.applicationId} />
            </PreparationSupportingContext>
          ) : (
            <JobContextEditor applicationId={page.applicationId} />
          )}
        </>
      ) : workspace.status === 'loading' ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading the role context and active facts release…
          </CardContent>
        </Card>
      ) : page.focusedReview ? (
        <>
          <CoverLetterWorkflowFeedback
            page={page}
            workspace={workspace.value}
          />
          {page.actionError === null ? null : (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Cover-letter step failed</AlertTitle>
              <AlertDescription>{page.actionError}</AlertDescription>
            </Alert>
          )}
          <CoverLetterEditorCard page={page} workspace={workspace.value} />
          <PreparationSupportingContext description="Open the job context and generation settings when you need to verify why this candidate was produced.">
            <JobContextEditor
              applicationId={page.applicationId}
              initialContext={workspace.value.bootstrap.context.jobContext}
            />
            <CoverLetterGenerationSettings
              page={page}
              workspace={workspace.value}
            />
          </PreparationSupportingContext>
        </>
      ) : (
        <>
          <JobContextEditor
            applicationId={page.applicationId}
            initialContext={workspace.value.bootstrap.context.jobContext}
          />
          <CoverLetterGenerationSettings
            page={page}
            workspace={workspace.value}
          />
          <CoverLetterWorkflowFeedback
            page={page}
            workspace={workspace.value}
          />
          {page.actionError === null ? null : (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Cover-letter step failed</AlertTitle>
              <AlertDescription>{page.actionError}</AlertDescription>
            </Alert>
          )}
          <CoverLetterEditorCard page={page} workspace={workspace.value} />
        </>
      )}
    </PreparationPageFrame>
  )
}
