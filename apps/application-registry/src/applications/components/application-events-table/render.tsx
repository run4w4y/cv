import type { ApplicationEvent } from '@cv/application-registry-entity'
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

export const ApplicationEventsTable = ({
  events,
  error,
}: {
  readonly events: readonly ApplicationEvent[] | undefined
  readonly error?: string
}) => (
  <Card className="mt-4">
    <CardHeader className="flex-row items-center gap-2 pb-0">
      <History className="size-4 text-primary" />
      <CardTitle>Related events</CardTitle>
      {events === undefined ? null : (
        <Badge variant="outline" className="ml-auto">
          {events.length} recent
        </Badge>
      )}
    </CardHeader>
    <CardContent>
      {error === undefined ? null : (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle />
          <AlertTitle>Could not load related events</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {error !== undefined ? null : (
        <div
          data-slot="application-events-table"
          className="mt-4 max-h-80 overflow-auto rounded-md border border-border"
        >
          <Table className="min-w-3xl table-fixed">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">Occurred</TableHead>
                <TableHead className="w-48">Event</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-28">Revision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events === undefined
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
                : events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatDateTime(event.occurredAt)}
                      </TableCell>
                      <TableCell className="align-top">
                        <EventKindBadge kind={event.kind} />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        <EventPayload payload={event.payload} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className="font-mono tabular-nums"
                        >
                          #{event.revision}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              {events?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No events have been recorded for this application.
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
