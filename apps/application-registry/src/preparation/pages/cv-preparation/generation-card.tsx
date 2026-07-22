import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Select,
} from '@cv/internal-ui'
import { RefreshCw, Sparkles } from 'lucide-react'
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
            {actions.cvGenerationGuidance.fields.length} guided fields
          </Badge>
        </div>
        <Field className="max-w-48">
          <FieldLabel htmlFor="cv-facts-locale">Facts locale</FieldLabel>
          <Select
            id="cv-facts-locale"
            className="w-full"
            value={locale}
            options={bootstrap.context.factsRelease.locales.map(
              (availableLocale) => ({
                label: availableLocale,
                value: availableLocale,
              })
            )}
            disabled={actions.commandPending || refreshPending}
            onValueChange={(value) => {
              if (value !== null) onLocaleChange(value)
            }}
          />
        </Field>
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
        <Button
          className="w-fit"
          disabled={
            actions.commandPending ||
            actions.workflowOpen ||
            !actions.codexAvailable ||
            !actions.guidanceValid
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
      </CardContent>
    </Card>
  )
}
