import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Progress,
  ScrollArea,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cv/internal-ui'
import {
  CheckCircle2,
  CircleAlert,
  CircleDotDashed,
  Clock3,
  GitBranch,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router'

import {
  WorkflowDocumentBadge,
  WorkflowMetricCard,
  WorkflowPage,
  WorkflowPageHeader,
  WorkflowStatusBadge,
} from './components'
import {
  batchCompletionPercent,
  dashboardMetrics,
  formatWorkflowTime,
  shortWorkflowId,
  type WorkflowBatchListItem,
} from './presentation'

export const WorkflowDashboardScreen = ({
  batches,
  error = null,
  loading = false,
}: {
  readonly batches: ReadonlyArray<WorkflowBatchListItem>
  readonly error?: string | null
  readonly loading?: boolean
}) => {
  const metrics = dashboardMetrics(batches)

  return (
    <WorkflowPage>
      <WorkflowPageHeader
        title="URL workflows"
        description="Launch preparation as a batch, follow every URL independently, and move generated documents through review and publication."
        actions={
          <Button render={<Link to="/workflows/new" />}>
            <Plus />
            New workflow
          </Button>
        }
      />

      <Alert>
        <GitBranch />
        <AlertTitle>
          Workflow history is scoped to this desktop session
        </AlertTitle>
        <AlertDescription>
          Saved applications and document revisions remain in the registry, but
          live run logs and batch grouping are cleared when the app restarts.
        </AlertDescription>
      </Alert>

      <section
        aria-label="Workflow summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <WorkflowMetricCard
          label="Active jobs"
          value={metrics.active}
          description="Queued or executing"
          icon={CircleDotDashed}
        />
        <WorkflowMetricCard
          label="Needs review"
          value={metrics.needsReview}
          description="Waiting on a decision"
          icon={Clock3}
          tone="warning"
        />
        <WorkflowMetricCard
          label="Failed"
          value={metrics.failed}
          description="Needs investigation"
          icon={CircleAlert}
          tone="danger"
        />
        <WorkflowMetricCard
          label="Completed"
          value={metrics.completed}
          description="Decisions submitted"
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      {error === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Workflow runtime unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent batches</CardTitle>
          <CardDescription>
            A batch groups jobs launched with the same document settings. Each
            URL still progresses and fails independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner aria-hidden />
              Loading workflow runtime…
            </div>
          ) : batches.length === 0 ? (
            <div className="p-4 pt-0">
              <Empty className="border-0 bg-transparent py-12">
                <EmptyHeader>
                  <EmptyMedia>
                    <GitBranch />
                  </EmptyMedia>
                  <EmptyTitle>No workflow batches yet</EmptyTitle>
                  <EmptyDescription>
                    Start with one or more job URLs. You will confirm document
                    settings before anything runs.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button render={<Link to="/workflows/new" />}>
                    <Plus />
                    Create first workflow
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <ScrollArea className="w-full" orientation="horizontal">
              <Table className="min-w-[58rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const percent = batchCompletionPercent(batch)
                    return (
                      <TableRow key={batch.batchId}>
                        <TableCell>
                          <div className="grid gap-1">
                            <span className="font-mono text-xs font-medium">
                              {shortWorkflowId(batch.batchId)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {batch.total} URL{batch.total === 1 ? '' : 's'} ·{' '}
                              {batch.locale}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <WorkflowStatusBadge status={batch.status} />
                        </TableCell>
                        <TableCell>
                          <WorkflowDocumentBadge kind={batch.kind} />
                        </TableCell>
                        <TableCell>
                          <div className="grid min-w-52 gap-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{percent}% finished</span>
                              <span>
                                {batch.needsReview > 0
                                  ? `${batch.needsReview} to review`
                                  : `${batch.active} active`}
                              </span>
                            </div>
                            <Progress
                              aria-label={`${percent}% of batch jobs finished`}
                              value={percent}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatWorkflowTime(batch.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            render={
                              <Link
                                to={`/workflows/${encodeURIComponent(batch.batchId)}`}
                              />
                            }
                          >
                            Open batch
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </WorkflowPage>
  )
}
