import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Select,
  Textarea,
} from '@cv/internal-ui'
import { RefreshCw, Sparkles } from 'lucide-react'

import { LocalCodex } from '@/preparation/components/local-codex'
import type {
  CoverLetterPageController,
  CoverLetterWorkspace,
} from './use-page-controller'

const generationButtonLabel = (
  page: CoverLetterPageController,
  workspace: CoverLetterWorkspace
): string => {
  if (page.startPending) return 'Starting Workflow…'
  if (page.workflowExecuting && workspace.run !== null) {
    return `Running: ${workspace.run.stage}`
  }
  if (workspace.run?.status === 'awaiting_review') {
    return 'Review current candidate first'
  }
  return 'Run preparation Workflow'
}

export const CoverLetterGenerationSettings = ({
  page,
  workspace,
}: {
  readonly page: CoverLetterPageController
  readonly workspace: CoverLetterWorkspace
}) => {
  const revision = workspace.editor.baseRevision?.revision

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <LocalCodex />
      <Card>
        <CardHeader>
          <CardTitle>Generation settings</CardTitle>
          <CardDescription>
            This prompt feeds a local multi-stage Effect Workflow and is never
            stored as an AI conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              Snapshot{' '}
              {revision?.jobSnapshotId ??
                workspace.bootstrap.context.jobSnapshot.id}
            </Badge>
            <Badge variant="outline">
              Facts{' '}
              {revision?.factsReleaseId ??
                workspace.bootstrap.context.factsReleaseId}
            </Badge>
            <Button
              variant="outline"
              disabled={
                page.actionPending ||
                page.snapshotRefreshPending ||
                page.workflowExecuting
              }
              onClick={() => void page.refreshJobSnapshot()}
            >
              <RefreshCw />
              {page.snapshotRefreshPending
                ? 'Refreshing posting…'
                : 'Refresh job posting'}
            </Button>
          </div>
          <Field className="max-w-48">
            <FieldLabel htmlFor="cover-letter-locale">Facts locale</FieldLabel>
            <Select
              id="cover-letter-locale"
              className="w-full"
              value={page.locale}
              options={workspace.bootstrap.context.factsRelease.locales.map(
                (availableLocale) => ({
                  label: availableLocale,
                  value: availableLocale,
                })
              )}
              disabled={page.actionPending}
              onValueChange={(value) => {
                if (value !== null) page.changeLocale(value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cover-letter-prompt">
              Writing instructions
            </FieldLabel>
            <FieldDescription>
              Adjust tone, emphasis, and length for this application.
            </FieldDescription>
            <Textarea
              id="cover-letter-prompt"
              className="min-h-32"
              value={page.prompt}
              disabled={page.actionPending}
              onChange={(event) => page.setPrompt(event.currentTarget.value)}
            />
          </Field>
          <Button
            className="w-fit"
            disabled={
              page.actionPending ||
              page.workflowOpen ||
              !page.codexAvailable ||
              page.prompt.trim().length === 0
            }
            onClick={() => void page.generate()}
          >
            <Sparkles />
            {generationButtonLabel(page, workspace)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
