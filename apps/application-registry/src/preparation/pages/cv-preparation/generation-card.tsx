import { cvDocumentV1GuidanceItems } from '@cv/application-preparation-workflow/cv'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { ModelSelector } from '@/preparation/components/model-selector'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import type { CvPreparationActions } from './actions'

export const CvGenerationCard = ({
  actions,
  locale,
  onLocaleChange,
  onRefreshSnapshot,
  refreshPending,
  workspace,
}: {
  readonly actions: CvPreparationActions
  readonly locale: string
  readonly onLocaleChange: (locale: string) => void
  readonly onRefreshSnapshot: () => void
  readonly refreshPending: boolean
  readonly workspace: PreparationWorkspace
}) => {
  const { bootstrap, editor, run } = workspace

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation context</CardTitle>
        <CardDescription>
          Capture, analysis, evidence planning, section briefs, composition,
          validation, persistence, and review run as one in-memory Effect
          Workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Snapshot{' '}
            {editor.baseRevision?.revision.jobSnapshotId ??
              bootstrap.context.jobSnapshot.id}
          </Badge>
          <Badge variant="outline">
            Facts{' '}
            {editor.baseRevision?.revision.factsReleaseId ??
              bootstrap.context.factsReleaseId}
          </Badge>
          <Badge variant="outline">Locale {locale}</Badge>
          <Badge variant="outline">
            {cvDocumentV1GuidanceItems.length} guidance rules
          </Badge>
        </div>
        <label className="grid max-w-48 gap-1 text-sm">
          <span className="font-medium">Facts locale</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3"
            value={locale}
            disabled={actions.commandPending || refreshPending}
            onChange={(event) => onLocaleChange(event.currentTarget.value)}
          >
            {bootstrap.context.factsRelease.locales.map((availableLocale) => (
              <option key={availableLocale} value={availableLocale}>
                {availableLocale}
              </option>
            ))}
          </select>
        </label>
        <Button
          className="w-fit"
          variant="outline"
          disabled={
            actions.commandPending ||
            refreshPending ||
            actions.workflowExecuting
          }
          onClick={onRefreshSnapshot}
        >
          <RefreshCw />
          {refreshPending ? 'Refreshing posting…' : 'Refresh job posting'}
        </Button>
        <ModelSelector
          authenticated={actions.authenticated}
          value={actions.selectedModel}
          onChange={actions.selectModel}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              actions.commandPending ||
              actions.workflowOpen ||
              !actions.authenticated ||
              actions.selectedModel === null
            }
            onClick={() => void actions.generate()}
          >
            <Sparkles />
            {actions.startPending
              ? 'Starting workflow…'
              : actions.workflowExecuting
                ? `Running: ${run?.stage ?? 'starting'}`
                : run?.status === 'awaiting_review'
                  ? 'Review current candidate first'
                  : 'Run preparation workflow'}
          </Button>
          <Link
            to="/schema/cv-document"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            Inspect schema guidance
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
