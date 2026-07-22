import type { ApplicationActivity } from '@cv/application-registry-entity'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cv/internal-ui'
import { AlertCircle, History } from 'lucide-react'

import { EventKindBadge } from '../../../events/components/event-kind-badge'
import { EventPayload } from '../../../events/components/event-payload'
import { formatDateTime } from '../../../lib/format'

export const ApplicationActivitiesTable = ({
  activities,
  error,
}: {
  readonly activities: readonly ApplicationActivity[] | undefined
  readonly error?: string
}) => (
  <Card className="mt-4">
    <CardHeader className="flex-row items-center gap-2 pb-0">
      <History className="size-4 text-primary" />
      <CardTitle>Related activities</CardTitle>
      {activities === undefined ? null : (
        <Badge variant="outline" className="ml-auto">
          {activities.length} recent
        </Badge>
      )}
    </CardHeader>
    <CardContent>
      {error === undefined ? null : (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle />
          <AlertTitle>Could not load related activities</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {error !== undefined ? null : (
        <div
          data-slot="application-activities-table"
          className="mt-4 max-h-80 overflow-auto rounded-md border border-border"
        >
          <Table className="min-w-3xl table-fixed">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">Occurred</TableHead>
                <TableHead className="w-48">Activity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-28">Revision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities === undefined
                ? Array.from(
                    { length: 3 },
                    (_, index) => `event-skeleton-${index}`
                  ).map((key) => (
                    <TableRow key={key} aria-hidden>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-14" />
                      </TableCell>
                    </TableRow>
                  ))
                : activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatDateTime(activity.occurredAt)}
                      </TableCell>
                      <TableCell className="align-top">
                        <EventKindBadge kind={activity.kind} />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        <EventPayload payload={activity.payload} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className="font-mono tabular-nums"
                        >
                          #{activity.revision}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              {activities?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No activities have been issued for this application.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
)
