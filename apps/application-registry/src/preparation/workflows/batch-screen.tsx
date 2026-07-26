import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Progress,
  ScrollArea,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@cv/internal-ui'
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDotDashed,
  Clock3,
  ExternalLink,
  ListFilter,
  RotateCcw,
  Search,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'

import {
  WorkflowDocumentBadges,
  WorkflowPage,
  WorkflowPageHeader,
  WorkflowStatusBadge,
} from './components'
import {
  batchCompletionPercent,
  formatWorkflowDuration,
  formatWorkflowTime,
  shortWorkflowId,
  type WorkflowBatchListItem,
  type WorkflowJobListItem,
  workflowJobTitle,
  workflowStageLabel,
} from './presentation'

type JobFilter = 'all' | 'active' | 'review' | 'failed' | 'finished'

const activeStatuses = new Set(['queued', 'running', 'cancelling'])

const filterJob = (job: WorkflowJobListItem, filter: JobFilter): boolean => {
  if (filter === 'all') return true
  if (filter === 'active') return activeStatuses.has(job.status)
  if (filter === 'review') return job.status === 'needs_review'
  if (filter === 'failed')
    return job.status === 'failed' || job.status === 'mixed'
  return job.status === 'completed' || job.status === 'cancelled'
}

const canCancel = (job: WorkflowJobListItem): boolean =>
  job.status === 'queued' ||
  job.status === 'running' ||
  job.status === 'needs_review'

export const newAiWorkflowPostingTargetHref = (
  postingUrl: string,
  locale: string
): string =>
  `/ai-workflows/new?postingUrl=${encodeURIComponent(postingUrl)}&locale=${encodeURIComponent(locale)}`

const JobRow = ({
  batchId,
  cancelling,
  job,
  onCancel,
}: {
  readonly batchId: string
  readonly cancelling: boolean
  readonly job: WorkflowJobListItem
  readonly onCancel: (jobId: string) => void
}) => (
  <TableRow>
    <TableCell>
      <div className="grid max-w-md gap-1">
        <span className="truncate font-medium" title={workflowJobTitle(job)}>
          {workflowJobTitle(job)}
        </span>
        <span
          className="truncate text-xs text-muted-foreground"
          title={job.url}
        >
          {job.url}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          Job {job.position + 1} · {shortWorkflowId(job.jobId)}
        </span>
        <span>
          <WorkflowDocumentBadges kinds={job.kinds} />
        </span>
      </div>
    </TableCell>
    <TableCell>
      <WorkflowStatusBadge status={job.status} />
    </TableCell>
    <TableCell>
      <div className="grid min-w-40 gap-1">
        <span className="text-sm">
          {job.artifacts
            .map(
              (artifact) =>
                `${artifact.kind === 'cv' ? 'CV' : 'Letter'}: ${workflowStageLabel(artifact.stage)}`
            )
            .join(' · ')}
        </span>
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {job.message}
        </span>
      </div>
    </TableCell>
    <TableCell className="text-xs tabular-nums text-muted-foreground">
      {formatWorkflowDuration(job.createdAt, job.updatedAt)}
    </TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant={job.status === 'needs_review' ? 'default' : 'outline'}
          render={
            <Link
              to={`/ai-workflows/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(job.jobId)}`}
            />
          }
        >
          <ExternalLink />
          {job.status === 'needs_review' ? 'Review' : 'Details'}
        </Button>
        {!canCancel(job) ? null : (
          <Button
            aria-label={`Cancel workflow for ${job.url}`}
            size="icon-sm"
            variant="ghost"
            disabled={cancelling}
            onClick={() => onCancel(job.jobId)}
          >
            {cancelling ? <Spinner aria-hidden /> : <Ban />}
          </Button>
        )}
        {job.status !== 'failed' && job.status !== 'cancelled' ? null : (
          <Button
            aria-label={`Set up another workflow for ${job.url}`}
            size="icon-sm"
            variant="ghost"
            render={
              <Link to={newAiWorkflowPostingTargetHref(job.url, job.locale)} />
            }
          >
            <RotateCcw />
          </Button>
        )}
      </div>
    </TableCell>
  </TableRow>
)

export type WorkflowBatchScreenProps = {
  readonly batch: WorkflowBatchListItem
  readonly cancelError: string | null
  readonly cancellingJobIds: ReadonlySet<string>
  readonly jobs: ReadonlyArray<WorkflowJobListItem>
  readonly onCancelAll: () => void
  readonly onCancelJob: (jobId: string) => void
}

export const WorkflowBatchScreen = ({
  batch,
  cancelError,
  cancellingJobIds,
  jobs,
  onCancelAll,
  onCancelJob,
}: WorkflowBatchScreenProps) => {
  const [filter, setFilter] = React.useState<JobFilter>('all')
  const [query, setQuery] = React.useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredJobs = jobs.filter(
    (job) =>
      filterJob(job, filter) &&
      (normalizedQuery.length === 0 ||
        job.url.toLocaleLowerCase().includes(normalizedQuery) ||
        job.jobId.toLocaleLowerCase().includes(normalizedQuery))
  )
  const cancellableJobs = jobs.filter(canCancel)
  const percent = batchCompletionPercent(batch)

  return (
    <WorkflowPage>
      <WorkflowPageHeader
        backTo="/ai-workflows"
        backLabel="All AI workflows"
        title={`Batch ${shortWorkflowId(batch.batchId)}`}
        description="Monitor every target independently. A slow or failed job does not block the rest of this batch."
        metadata={
          <>
            <WorkflowStatusBadge status={batch.status} />
            <WorkflowDocumentBadges kinds={batch.kinds} />
            <Badge variant="outline">Locale {batch.locale}</Badge>
            <span className="text-xs text-muted-foreground">
              Started {formatWorkflowTime(batch.createdAt)}
            </span>
          </>
        }
        actions={
          cancellableJobs.length === 0 ? null : (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive">
                    <Ban />
                    Cancel active jobs
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel active jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This requests cancellation for {cancellableJobs.length} job
                    {cancellableJobs.length === 1 ? '' : 's'}. Saved candidate
                    revisions are not deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancelAll}>
                    Cancel jobs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <Card>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">Batch progress</span>
              <span className="tabular-nums text-muted-foreground">
                {percent}% terminal
              </span>
            </div>
            <Progress
              value={percent}
              aria-label={`${percent}% of jobs reached a terminal state`}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <CircleDotDashed className="size-4 text-muted-foreground" />
              <span>
                <strong className="tabular-nums">{batch.active}</strong> active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-amber-700" />
              <span>
                <strong className="tabular-nums">{batch.needsReview}</strong>{' '}
                review
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CircleAlert className="size-4 text-destructive" />
              <span>
                <strong className="tabular-nums">{batch.failed}</strong> failed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-700" />
              <span>
                <strong className="tabular-nums">{batch.completed}</strong>{' '}
                complete
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {cancelError === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Cancellation failed</AlertTitle>
          <AlertDescription>{cancelError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {batch.targetCount} target
              {batch.targetCount === 1 ? '' : 's'} ·{' '}
              {jobs.reduce((count, job) => count + job.artifacts.length, 0)}{' '}
              document workflow
              {jobs.reduce((count, job) => count + job.artifacts.length, 0) ===
              1
                ? ''
                : 's'}
            </CardDescription>
          </div>
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as JobFilter)}
            >
              <TabsList
                aria-label="Filter jobs"
                className="max-w-full overflow-x-auto"
              >
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
                <TabsTrigger value="finished">Finished</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search workflow jobs"
                className="w-full pl-9"
                placeholder="Search URL or job ID"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredJobs.length === 0 ? (
            <div className="p-4 pt-0">
              <Empty className="border-0 bg-transparent py-10">
                <EmptyHeader>
                  <EmptyMedia>
                    <ListFilter />
                  </EmptyMedia>
                  <EmptyTitle>No matching jobs</EmptyTitle>
                  <EmptyDescription>
                    Change the status filter or clear the search query.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <ScrollArea className="w-full" orientation="horizontal">
              <Table className="min-w-[64rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Job URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current step</TableHead>
                    <TableHead>Recorded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <JobRow
                      key={job.jobId}
                      batchId={batch.batchId}
                      cancelling={cancellingJobIds.has(job.jobId)}
                      job={job}
                      onCancel={onCancelJob}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </WorkflowPage>
  )
}
