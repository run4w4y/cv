import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { useAtom } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { Ban, CircleAlert, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { asyncResultErrorMessage } from '@/lib/async-result'
import { cancelPreparationRunAtom } from '@/preparation/workflow/atoms'

const reviewPath = (run: PreparationRun): string | null => {
  if (run.applicationId === null) return null
  const page = run.kind === 'cv' ? 'prepare' : 'cover-letter'
  return `/applications/${encodeURIComponent(run.applicationId)}/${page}?locale=${encodeURIComponent(run.locale)}&run=${encodeURIComponent(run.runId)}`
}

const canCancel = (run: PreparationRun) =>
  run.status === 'queued' ||
  run.status === 'running' ||
  run.status === 'awaiting_review'

export const PreparationRunCard = ({
  run,
}: {
  readonly run: PreparationRun
}) => {
  const [cancelResult, cancel] = useAtom(cancelPreparationRunAtom(run.runId), {
    mode: 'promiseExit',
  })
  const cancelling = AsyncResult.isWaiting(cancelResult)
  const cancelError =
    asyncResultErrorMessage(
      cancelResult,
      'The preparation workflow could not be cancelled.'
    ) ?? null
  const path = reviewPath(run)
  const totalTokens =
    run.candidate?.candidate.metadata.reduce(
      (total, item) => total + (item.usage.totalTokens ?? 0),
      0
    ) ?? 0

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{run.url}</CardTitle>
            <CardDescription>{run.message}</CardDescription>
          </div>
          <Badge variant="outline">{run.status.replace('_', ' ')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{run.kind.replace('_', ' ')}</Badge>
          <span>Stage: {run.stage}</span>
          {run.candidate === null ? null : (
            <span>
              {run.candidate.candidate.metadata.length} Codex calls ·{' '}
              {totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>
        {run.error === null ? null : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{run.error}</AlertDescription>
          </Alert>
        )}
        {cancelError === null ? null : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{cancelError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {path === null ? null : (
            <Button
              variant={run.status === 'awaiting_review' ? 'default' : 'outline'}
              render={<Link to={path} />}
            >
              <ExternalLink />
              {run.status === 'awaiting_review'
                ? 'Review candidate'
                : 'Open application'}
            </Button>
          )}
          {!canCancel(run) ? null : (
            <Button
              variant="outline"
              disabled={cancelling}
              onClick={() => {
                void cancel({ runId: run.runId })
              }}
            >
              <Ban />
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
