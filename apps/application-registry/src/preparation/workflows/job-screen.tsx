import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@cv/internal-ui'
import {
  Ban,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router'

import {
  WorkflowDocumentBadge,
  WorkflowPage,
  WorkflowPageHeader,
  WorkflowStatusBadge,
} from './components'
import {
  formatWorkflowDuration,
  formatWorkflowTime,
  shortWorkflowId,
  type WorkflowJobListItem,
  type WorkflowStepListItem,
} from './presentation'

export type WorkflowArtifactSummary = {
  readonly codexCalls: number
  readonly revisionNumber: number
  readonly tokens: number
}

const timelineStatus = (
  status: WorkflowStepListItem['status']
): 'pending' | 'active' | 'complete' | 'error' | 'skipped' => {
  if (status === 'completed') return 'complete'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'skipped'
  if (status === 'running' || status === 'waiting') return 'active'
  return 'pending'
}

const canCancel = (status: WorkflowJobListItem['status']): boolean =>
  status === 'queued' ||
  status === 'running' ||
  status === 'awaiting_review' ||
  status === 'review_submitted'

export type WorkflowJobScreenProps = {
  readonly artifact: WorkflowArtifactSummary | null
  readonly cancelError: string | null
  readonly cancelling: boolean
  readonly job: WorkflowJobListItem
  readonly onCancel: () => void
  readonly steps: ReadonlyArray<WorkflowStepListItem>
}

export const WorkflowJobScreen = ({
  artifact,
  cancelError,
  cancelling,
  job,
  onCancel,
  steps,
}: WorkflowJobScreenProps) => (
  <WorkflowPage>
    <WorkflowPageHeader
      backTo={`/workflows/${encodeURIComponent(job.batchId)}`}
      backLabel="Batch overview"
      eyebrow={`Job ${job.position + 1} of batch ${shortWorkflowId(job.batchId)}`}
      title={job.url}
      description={job.message}
      metadata={
        <>
          <WorkflowStatusBadge status={job.status} />
          <WorkflowDocumentBadge kind={job.kind} />
          <Badge variant="outline">Locale {job.locale}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {shortWorkflowId(job.runId)}
          </span>
        </>
      }
      actions={
        <>
          {job.status !== 'awaiting_review' ? null : (
            <Button
              render={
                <Link
                  to={`/workflows/${encodeURIComponent(job.batchId)}/jobs/${encodeURIComponent(job.runId)}/review`}
                />
              }
            >
              <FileCheck2 />
              Review candidate
            </Button>
          )}
          {!canCancel(job.status) ? null : (
            <Button variant="outline" disabled={cancelling} onClick={onCancel}>
              <Ban />
              {cancelling ? 'Cancelling…' : 'Cancel job'}
            </Button>
          )}
          {job.status !== 'failed' && job.status !== 'cancelled' ? null : (
            <Button
              variant="outline"
              render={
                <Link
                  to={`/workflows/new?url=${encodeURIComponent(job.url)}&kind=${job.kind}&locale=${encodeURIComponent(job.locale)}`}
                />
              }
            >
              <RotateCcw />
              Run again
            </Button>
          )}
        </>
      }
    />

    {job.error === null ? null : (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Workflow failed</AlertTitle>
        <AlertDescription>{job.error}</AlertDescription>
      </Alert>
    )}

    {cancelError === null ? null : (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Cancellation failed</AlertTitle>
        <AlertDescription>{cancelError}</AlertDescription>
      </Alert>
    )}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Workflow timeline</CardTitle>
          <CardDescription>
            The step log is append-only for this session. Waiting means the
            generated artifact is safely stored before human review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline aria-label="Workflow step history">
            {steps.map((step) => (
              <TimelineItem
                key={step.stage}
                status={timelineStatus(step.status)}
              >
                <TimelineIndicator />
                <TimelineConnector />
                <TimelineContent>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <TimelineTitle>{step.title}</TimelineTitle>
                    <Badge variant="outline">
                      {step.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <TimelineDescription>{step.description}</TimelineDescription>
                  {step.startedAt === null ? null : (
                    <TimelineTime
                      dateTime={new Date(step.startedAt).toISOString()}
                    >
                      {formatWorkflowTime(step.startedAt)}
                      {step.completedAt === null
                        ? ''
                        : ` · ${formatWorkflowDuration(step.startedAt, step.completedAt)}`}
                    </TimelineTime>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Started</dt>
                <dd className="mt-1">{formatWorkflowTime(job.createdAt)}</dd>
              </div>
              <Separator />
              <div>
                <dt className="text-xs text-muted-foreground">Last update</dt>
                <dd className="mt-1">{formatWorkflowTime(job.updatedAt)}</dd>
              </div>
              <Separator />
              <div>
                <dt className="text-xs text-muted-foreground">
                  Recorded duration
                </dt>
                <dd className="mt-1 tabular-nums">
                  {formatWorkflowDuration(job.createdAt, job.updatedAt)}
                </dd>
              </div>
              <Separator />
              <div>
                <dt className="text-xs text-muted-foreground">Source URL</dt>
                <dd className="mt-1 break-all">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open posting
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              Generated artifact
            </CardTitle>
          </CardHeader>
          <CardContent>
            {artifact === null ? (
              <p className="text-sm text-muted-foreground">
                No candidate has been persisted yet.
              </p>
            ) : (
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Revision</dt>
                  <dd className="font-medium tabular-nums">
                    {artifact.revisionNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Codex calls</dt>
                  <dd className="font-medium tabular-nums">
                    {artifact.codexCalls}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tokens</dt>
                  <dd className="font-medium tabular-nums">
                    {artifact.tokens.toLocaleString()}
                  </dd>
                </div>
                {job.applicationId === null ? null : (
                  <Button
                    className="mt-1 w-full"
                    variant="outline"
                    render={
                      <Link
                        to={`/applications/${encodeURIComponent(job.applicationId)}`}
                      />
                    }
                  >
                    Open application
                    <ExternalLink />
                  </Button>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </WorkflowPage>
)
