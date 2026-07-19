import type { RegistryActivityListItem } from '@cv/application-registry-api-contract'
import { Badge } from '@cv/internal-ui'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { formatDateTime } from '../../../lib/format'
import { EventKindBadge } from '../event-kind-badge'
import { EventPayload } from '../event-payload'

export const eventColumns: ColumnDef<RegistryActivityListItem>[] = [
  {
    accessorKey: 'occurredAt',
    header: 'Occurred',
    size: 180,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(getValue<string>())}
      </span>
    ),
  },
  {
    id: 'application',
    accessorFn: (row) => `${row.company} ${row.role}`,
    header: 'Application',
    enableSorting: false,
    size: 300,
    cell: ({ row }) => (
      <div className="min-w-52 whitespace-normal break-words">
        <p className="line-clamp-2 font-semibold text-foreground">
          {row.original.company}
        </p>
        <p className="mt-0.5 line-clamp-3 text-xs/4 text-muted-foreground">
          {row.original.role}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'kind',
    header: 'Activity',
    size: 190,
    cell: ({ getValue }) => <EventKindBadge kind={getValue<string>()} />,
  },
  {
    accessorKey: 'payload',
    header: 'Details',
    enableSorting: false,
    size: 380,
    cell: ({ getValue }) => <EventPayload payload={getValue<unknown>()} />,
  },
  {
    accessorKey: 'revision',
    header: 'Revision',
    size: 110,
    cell: ({ getValue }) => (
      <Badge variant="outline" className="font-mono tabular-nums">
        #{getValue<number>()}
      </Badge>
    ),
  },
  {
    accessorKey: 'actor',
    header: 'Actor',
    size: 180,
    cell: ({ getValue }) => {
      const value = getValue<string>()
      return <span className="text-xs text-muted-foreground">{value}</span>
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
    size: 180,
    cell: ({ getValue }) => (
      <span className="whitespace-normal break-all font-mono text-xs text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    id: 'sourceLink',
    header: '',
    enableSorting: false,
    enableHiding: false,
    size: 56,
    cell: ({ row }) => (
      <a
        href={row.original.postingUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${row.original.company} listing`}
        onClick={(event) => event.stopPropagation()}
        className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ExternalLink className="size-4" />
      </a>
    ),
  },
]
