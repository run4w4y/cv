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
  WorkflowDocumentBadges,
  WorkflowPage,
  WorkflowPageHeader,
  WorkflowStatusBadge,
} from './components'
import {
  documentKindLabel,
  formatWorkflowDuration,
  formatWorkflowTime,
  shortWorkflowId,
  type WorkflowArtifactListItem,
  type WorkflowJobListItem,
  type WorkflowStepListItem,
  workflowJobTitle,
} from './presentation'

export type WorkflowArtifactSummary = {
  readonly codexCalls: number
  readonly revisionNumber: number
  readonly tokens: number
}

export type WorkflowArtifactScreenItem = {
  readonly artifact: WorkflowArtifactListItem
  readonly steps: ReadonlyArray<WorkflowStepListItem>
  readonly summary: WorkflowArtifactSummary | null
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
  status === 'queued' || status === 'running' || status === 'needs_review'

export type WorkflowJobScreenProps = {
  readonly artifacts: ReadonlyArray<WorkflowArtifactScreenItem>
  readonly cancelError: string | null
  readonly cancelling: boolean
  readonly job: WorkflowJobListItem
  readonly onCancel: () => void
}

export const WorkflowJobScreen = ({
  artifacts,
  cancelError,
  cancelling,
  job,
  onCancel,
}: WorkflowJobScreenProps) => (
  <WorkflowPage>
    <WorkflowPageHeader
      backTo={`/workflows/${encodeURIComponent(job.batchId)}`}
      backLabel="Batch overview"
      eyebrow={`Job ${job.position + 1} of batch ${shortWorkflowId(job.batchId)}`}
      title={workflowJobTitle(job)}
      description={job.message}
      metadata={
        <>
          <WorkflowStatusBadge status={job.status} />
          <WorkflowDocumentBadges kinds={job.kinds} />
          <Badge variant="outline">Locale {job.locale}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {shortWorkflowId(job.jobId)}
          </span>
        </>
      }
      actions={
        <>
          {artifacts
            .filter(({ artifact }) => artifact.status === 'awaiting_review')
            .map(({ artifact }) => (
              <Button
                key={artifact.runId}
                render={
                  <Link
                    to={`/workflows/${encodeURIComponent(job.batchId)}/jobs/${encodeURIComponent(job.jobId)}/artifacts/${artifact.kind}/review`}
                  />
                }
              >
                <FileCheck2 />
                Review {artifact.kind === 'cv' ? 'CV' : 'letter'}
              </Button>
            ))}
          {!canCancel(job.status) ? null : (
            <Button variant="outline" disabled={cancelling} onClick={onCancel}>
              <Ban />
              {cancelling ? 'Cancelling…' : 'Cancel job'}
            </Button>
          )}
          {job.status !== 'failed' &&
          job.status !== 'cancelled' &&
          job.status !== 'mixed' ? null : (
            <Button
              variant="outline"
              render={
                <Link
                  to={`/workflows/new?url=${encodeURIComponent(job.url)}&locale=${encodeURIComponent(job.locale)}`}
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

    {artifacts.flatMap(({ artifact }) =>
      artifact.error === null
        ? []
        : [
            <Alert key={artifact.runId} variant="destructive">
              <CircleAlert />
              <AlertTitle>{documentKindLabel(artifact.kind)} failed</AlertTitle>
              <AlertDescription>{artifact.error}</AlertDescription>
            </Alert>,
          ]
    )}

    {cancelError === null ? null : (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Cancellation failed</AlertTitle>
        <AlertDescription>{cancelError}</AlertDescription>
      </Alert>
    )}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        {artifacts.map(({ artifact, steps }) => (
          <Card key={artifact.runId}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{documentKindLabel(artifact.kind)}</CardTitle>
                  <CardDescription>{artifact.message}</CardDescription>
                </div>
                <WorkflowStatusBadge status={artifact.status} />
              </div>
            </CardHeader>
            <CardContent>
              <Timeline
                aria-label={`${documentKindLabel(artifact.kind)} workflow step history`}
              >
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
                      <TimelineDescription>
                        {step.description}
                      </TimelineDescription>
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
        ))}
      </div>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job details</CardTitle>
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
              Generated artifacts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {artifacts.map(({ artifact, summary }, index) => (
              <div key={artifact.runId} className="grid gap-3">
                {index === 0 ? null : <Separator />}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {documentKindLabel(artifact.kind)}
                  </span>
                  <WorkflowStatusBadge status={artifact.status} />
                </div>
                {summary === null ? (
                  <p className="text-sm text-muted-foreground">
                    No candidate has been persisted yet.
                  </p>
                ) : (
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Revision</dt>
                      <dd className="font-medium tabular-nums">
                        {summary.revisionNumber}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Codex calls</dt>
                      <dd className="font-medium tabular-nums">
                        {summary.codexCalls}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Tokens</dt>
                      <dd className="font-medium tabular-nums">
                        {summary.tokens.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            ))}
            {job.applicationId === null ? null : (
              <Button
                className="w-full"
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
          </CardContent>
        </Card>
      </div>
    </div>
  </WorkflowPage>
)
