import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import {
  Badge,
  BadgeOverflow,
  Button,
  buttonVariants,
  cn,
} from '@cv/internal-ui'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, FolderOpen, Pencil, Tag } from 'lucide-react'
import { Link } from 'react-router'

import { formatDateTime, formatLabel } from '../../../lib/format'
import { AnnualCompensation } from '../annual-compensation'
import { ListingAvailabilityReviewDialog } from '../listing-availability-review'
import { StatusBadge } from '../status-badge'
import {
  CompanyEditor,
  CompensationEditor,
  FollowUpEditor,
  LabelsEditor,
  PriorityEditor,
  RoleEditor,
  RowEditorActions,
  StatusEditor,
  TargetEditor,
} from './editors'

const EmptyValue = () => <span className="text-muted-foreground">—</span>

export type ApplicationColumnsOptions = {
  readonly availableLabels: readonly string[]
  readonly editingRowId?: string
  readonly onBeginEditing: (application: ApplicationListItem) => void
}

export const createApplicationColumns = ({
  availableLabels,
  editingRowId,
  onBeginEditing,
}: ApplicationColumnsOptions): readonly ColumnDef<ApplicationListItem>[] => [
  {
    accessorKey: 'company',
    header: 'Company',
    size: 260,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <CompanyEditor />
      ) : (
        <div className="min-w-44 whitespace-normal break-words">
          <p className="line-clamp-2 font-semibold text-foreground">
            {row.original.company}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {row.original.location ?? 'Location not specified'}
          </p>
        </div>
      ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    size: 300,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <RoleEditor />
      ) : (
        <div className="min-w-52 whitespace-normal break-words">
          <p className="line-clamp-3 font-medium">{row.original.role}</p>
          <p className="mt-0.5 line-clamp-2 break-all font-mono text-[0.6875rem] text-muted-foreground">
            {row.original.id}
          </p>
        </div>
      ),
  },
  {
    accessorKey: 'applicationStatus',
    header: 'Status',
    size: 180,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <StatusEditor />
      ) : (
        <StatusBadge value={row.original.applicationStatus} />
      ),
  },
  {
    accessorKey: 'targetStage',
    header: 'Target',
    size: 170,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <TargetEditor />
      ) : (
        <Badge variant="outline" className="whitespace-normal text-center">
          {formatLabel(row.original.targetStage)}
        </Badge>
      ),
  },
  {
    accessorKey: 'personalPriority',
    header: 'Priority',
    size: 150,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <PriorityEditor />
      ) : row.original.personalPriority === null ? (
        <EmptyValue />
      ) : (
        <Badge variant="secondary">
          {formatLabel(row.original.personalPriority)}
        </Badge>
      ),
  },
  {
    id: 'labels',
    accessorFn: (row) => row.labels.join(', '),
    header: 'Labels',
    enableSorting: false,
    size: 260,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <LabelsEditor availableLabels={availableLabels} />
      ) : row.original.labels.length === 0 ? (
        <EmptyValue />
      ) : (
        <BadgeOverflow
          items={row.original.labels}
          maxVisible={2}
          className="max-w-52"
          renderBadge={(_, label) => (
            <>
              <Tag className="size-3" />
              {label}
            </>
          )}
        />
      ),
  },
  {
    accessorKey: 'annualCompensation',
    header: 'Annual compensation',
    enableSorting: false,
    size: 320,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <CompensationEditor />
      ) : (
        <AnnualCompensation value={row.original.annualCompensation} />
      ),
  },
  {
    accessorKey: 'followUpAt',
    header: 'Follow up',
    size: 260,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <FollowUpEditor />
      ) : (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.original.followUpAt)}
        </span>
      ),
  },
  {
    id: 'latestActivityAt',
    accessorFn: (row) => row.latestActivity?.occurredAt ?? null,
    header: 'Latest activity',
    size: 180,
    cell: ({ row }) => (
      <div className="whitespace-normal break-words text-xs">
        <p className="line-clamp-2">
          {row.original.latestActivity === null
            ? 'No activity'
            : formatLabel(row.original.latestActivity.kind)}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {formatDateTime(row.original.latestActivity?.occurredAt)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'listingAvailability',
    header: 'Listing',
    size: 200,
    cell: ({ row }) => (
      <ListingAvailabilityReviewDialog application={row.original} />
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    size: 170,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(getValue<string>())}
      </span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    enableHiding: false,
    size: 160,
    cell: ({ row }) =>
      editingRowId === row.original.id ? (
        <RowEditorActions company={row.original.company} />
      ) : (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={editingRowId !== undefined}
            aria-label={`Edit ${row.original.company} row`}
            onClick={() => onBeginEditing(row.original)}
          >
            <Pencil />
          </Button>
          <Link
            to={`/applications/${row.original.id}`}
            aria-label={`Open ${row.original.company} application`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' })
            )}
          >
            <FolderOpen />
          </Link>
          <a
            href={row.original.postingUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${row.original.company} listing`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' })
            )}
          >
            <ExternalLink />
          </a>
        </div>
      ),
  },
]
