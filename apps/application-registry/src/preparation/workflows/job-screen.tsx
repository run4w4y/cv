import type {
  PreparationActivityProjection,
  PreparationActivityScope,
  PreparationNodeStatus,
} from '@cv/application-preparation-workflow/domain'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineIndicator,
  TimelineItem,
  TimelineTitle,
} from '@cv/internal-ui'
import {
  Ban,
  CircleAlert,
  CornerDownRight,
  ExternalLink,
  FileCheck2,
  GitBranch,
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
  workflowJobTitle,
  workflowStageLabel,
} from './presentation'

export type WorkflowArtifactSummary = {
  readonly codexCalls: number
  readonly revisionNumber: number
  readonly tokens: number
}

export type WorkflowArtifactScreenItem = {
  readonly artifact: WorkflowArtifactListItem
  readonly summary: WorkflowArtifactSummary | null
}

const timelineStatus = (
  status: PreparationNodeStatus
): 'pending' | 'active' | 'complete' | 'error' | 'skipped' => {
  if (status === 'completed') return 'complete'
  if (status === 'failed') return 'error'
  if (status === 'blocked' || status === 'cancelled') return 'skipped'
  if (status === 'running' || status === 'waiting') return 'active'
  return 'pending'
}

const scopeLabel = (scope: PreparationActivityScope): string => {
  if (scope === 'shared') return 'Shared context'
  return scope === 'cv' ? 'CV' : 'Cover letter'
}

const artifactRouteKind = (kind: WorkflowArtifactListItem['kind']): string =>
  kind === 'cv' ? 'cv' : 'cover-letter'

const canCancel = (status: WorkflowJobListItem['status']): boolean =>
  status === 'queued' || status === 'running' || status === 'needs_review'

type ActivityNode = PreparationActivityProjection['nodes'][number]

const trackFocusNode = (
  nodes: ReadonlyArray<ActivityNode>
): ActivityNode | null =>
  nodes.find(
    ({ status }) =>
      status === 'running' ||
      status === 'waiting' ||
      status === 'failed' ||
      status === 'blocked'
  ) ??
  nodes.findLast(({ status }) => status !== 'pending') ??
  nodes[0] ??
  null

const ActivityTrack = ({
  dependency,
  label,
  nodes,
}: {
  readonly dependency: ActivityNode | null
  readonly label: string
  readonly nodes: ReadonlyArray<ActivityNode>
}) => {
  const focus = trackFocusNode(nodes)
  return (
    <section
      aria-label={`${label} activity`}
      className="min-w-0 rounded-lg border border-border bg-muted/15 p-4"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {dependency === null ? null : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerDownRight className="size-3.5" aria-hidden="true" />
            After {scopeLabel(dependency.scope)} · {dependency.label}
          </span>
        )}
      </div>

      <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
        <Timeline
          orientation="horizontal"
          aria-label={`${label} stages`}
          className="min-w-[38rem]"
        >
          {nodes.map((node) => (
            <TimelineItem
              key={node.id}
              status={timelineStatus(node.status)}
              data-node-id={node.id}
              data-depends-on={node.dependsOn.join(' ')}
            >
              <TimelineIndicator />
              <TimelineConnector />
              <TimelineContent>
                <TimelineTitle className="text-xs">{node.label}</TimelineTitle>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </div>

      {focus === null ? null : (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3">
          <WorkflowStatusBadge status={focus.status} />
          <p className="min-w-0 flex-1 text-xs/5 text-muted-foreground">
            {focus.message ??
              (focus.status === 'pending'
                ? 'Waiting for its dependencies.'
                : workflowStageLabel(focus.stage))}
          </p>
          {focus.startedAt === null ? null : (
            <time
              dateTime={new Date(focus.startedAt).toISOString()}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {formatWorkflowTime(focus.startedAt)}
              {focus.completedAt === null
                ? ''
                : ` · ${formatWorkflowDuration(focus.startedAt, focus.completedAt)}`}
            </time>
          )}
        </div>
      )}
    </section>
  )
}

const ActivityTimeline = ({
  activity,
}: {
  readonly activity: PreparationActivityProjection
}) => {
  const byId = new Map(activity.nodes.map((node) => [node.id, node]))
  const sharedNodes = activity.nodes.filter(({ scope }) => scope === 'shared')
  const branchScopes: ReadonlyArray<
    Exclude<PreparationActivityScope, 'shared'>
  > = ['cv', 'cover_letter']
  const branches = branchScopes.flatMap((scope) => {
    const nodes = activity.nodes.filter((node) => node.scope === scope)
    if (nodes.length === 0) return []
    const dependencyId = nodes[0]?.dependsOn[0]
    return [
      {
        dependency:
          dependencyId === undefined ? null : (byId.get(dependencyId) ?? null),
        label: scopeLabel(scope),
        nodes,
        scope,
      },
    ]
  })

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="size-4" />
          Activity
        </CardTitle>
        <p className="text-sm/6 text-muted-foreground">
          Shared work runs once. Each document then follows its own lane, with
          cross-document gates shown explicitly.
        </p>
      </CardHeader>
      <CardContent className="pt-5">
        <ActivityTrack
          dependency={null}
          label="Shared context"
          nodes={sharedNodes}
        />

        {branches.length === 0 ? null : (
          <>
            <div className="ml-5 h-5 w-px bg-border" aria-hidden="true" />
            <div className="grid gap-3">
              {branches.map((branch) => (
                <ActivityTrack
                  key={branch.scope}
                  dependency={branch.dependency}
                  label={branch.label}
                  nodes={branch.nodes}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export type WorkflowJobScreenProps = {
  readonly activity: PreparationActivityProjection
  readonly artifacts: ReadonlyArray<WorkflowArtifactScreenItem>
  readonly cancelError: string | null
  readonly cancelling: boolean
  readonly job: WorkflowJobListItem
  readonly onCancel: () => void
  readonly onRetry: () => void
  readonly retryError: string | null
  readonly retrying: boolean
}

export const WorkflowJobScreen = ({
  activity,
  artifacts,
  cancelError,
  cancelling,
  job,
  onCancel,
  onRetry,
  retryError,
  retrying,
}: WorkflowJobScreenProps) => (
  <WorkflowPage>
    <WorkflowPageHeader
      backTo={`/ai-workflows/${encodeURIComponent(job.batchId)}`}
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
              <Link
                key={artifact.kind}
                className={buttonVariants()}
                to={`/ai-workflows/${encodeURIComponent(job.batchId)}/jobs/${encodeURIComponent(job.jobId)}/artifacts/${artifactRouteKind(artifact.kind)}`}
              >
                <FileCheck2 />
                Review {artifact.kind === 'cv' ? 'CV' : 'letter'}
              </Link>
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
            <Button variant="outline" disabled={retrying} onClick={onRetry}>
              <RotateCcw />
              {retrying ? 'Starting…' : 'Run again'}
            </Button>
          )}
        </>
      }
    />

    {artifacts.flatMap(({ artifact }) =>
      artifact.error === null
        ? []
        : [
            <Alert key={artifact.kind} variant="destructive">
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

    {retryError === null ? null : (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Retry failed</AlertTitle>
        <AlertDescription>{retryError}</AlertDescription>
      </Alert>
    )}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ActivityTimeline activity={activity} />

      <aside className="grid gap-5">
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
                <dt className="text-xs text-muted-foreground">Source</dt>
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
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {artifacts.map(({ artifact, summary }, index) => (
              <div key={artifact.kind} className="grid gap-3">
                {index === 0 ? null : <Separator />}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {documentKindLabel(artifact.kind)}
                  </span>
                  <WorkflowStatusBadge status={artifact.status} />
                </div>
                <p className="text-sm/6 text-muted-foreground">
                  {artifact.message}
                </p>
                {summary === null ? null : (
                  <>
                    <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <dt className="text-muted-foreground">Revision</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {summary.revisionNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Calls</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {summary.codexCalls}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Tokens</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {summary.tokens.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      className={buttonVariants({
                        className: 'w-fit',
                        size: 'sm',
                        variant: 'outline',
                      })}
                      to={`/ai-workflows/${encodeURIComponent(job.batchId)}/jobs/${encodeURIComponent(job.jobId)}/artifacts/${artifactRouteKind(artifact.kind)}`}
                    >
                      <FileCheck2 />
                      {artifact.status === 'awaiting_review'
                        ? 'Review document'
                        : 'Open document'}
                    </Link>
                  </>
                )}
              </div>
            ))}
            {job.applicationId === null ? null : (
              <Link
                className={buttonVariants({
                  className: 'w-fit',
                  size: 'sm',
                  variant: 'outline',
                })}
                to={`/applications/${encodeURIComponent(job.applicationId)}`}
              >
                Open application
                <ExternalLink />
              </Link>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  </WorkflowPage>
)
