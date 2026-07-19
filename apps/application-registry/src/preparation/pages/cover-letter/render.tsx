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
import { PreparationPageFrame } from '@/preparation/components/page-frame'
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
      eyebrow="Separate writing flow"
      title="Prepare a cover letter"
      description="Customize the writing instructions, generate from the same job snapshot and reviewed facts, edit the result, and store it as an opaque cover-letter revision."
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
          <JobContextEditor applicationId={page.applicationId} />
        </>
      ) : workspace.status === 'loading' ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading the role context and active facts release…
          </CardContent>
        </Card>
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
