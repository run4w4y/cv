import { Badge, Button, Card, CardContent, cn } from '@cv/internal-ui'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type React from 'react'
import { Link } from 'react-router'

import {
  documentKindLabel,
  workflowStatusLabel,
  workflowStatusTone,
} from './presentation'

export const WorkflowPage = ({
  children,
  className,
}: {
  readonly children: React.ReactNode
  readonly className?: string
}) => (
  <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
    <div
      className={cn(
        'mx-auto grid min-w-0 w-full max-w-7xl gap-6 p-4 [&>*]:min-w-0 lg:p-8',
        className
      )}
    >
      {children}
    </div>
  </main>
)

export const WorkflowPageHeader = ({
  actions,
  backLabel,
  backTo,
  description,
  eyebrow = 'URL workflows',
  metadata,
  title,
}: {
  readonly actions?: React.ReactNode
  readonly backLabel?: string
  readonly backTo?: string
  readonly description: string
  readonly eyebrow?: string
  readonly metadata?: React.ReactNode
  readonly title: string
}) => (
  <header className="grid gap-4">
    {backTo === undefined ? null : (
      <Button
        className="w-fit"
        size="sm"
        variant="ghost"
        render={<Link to={backTo} />}
      >
        <ArrowLeft />
        {backLabel ?? 'Back'}
      </Button>
    )}
    <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight lg:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm/6 text-muted-foreground">
          {description}
        </p>
        {metadata === undefined || metadata === null ? null : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {metadata}
          </div>
        )}
      </div>
      {actions === undefined || actions === null ? null : (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      )}
    </div>
  </header>
)

export const WorkflowStatusBadge = ({
  status,
}: {
  readonly status: string
}) => (
  <Badge variant={workflowStatusTone(status)}>
    <span
      aria-hidden="true"
      className={cn(
        'size-1.5 rounded-full bg-current',
        (status === 'running' || status === 'active') && 'animate-pulse'
      )}
    />
    {workflowStatusLabel(status)}
  </Badge>
)

export const WorkflowDocumentBadge = ({
  kind,
}: {
  readonly kind: 'cv' | 'cover_letter'
}) => <Badge variant="outline">{documentKindLabel(kind)}</Badge>

export const WorkflowMetricCard = ({
  description,
  icon: Icon,
  label,
  tone = 'default',
  value,
}: {
  readonly description: string
  readonly icon: LucideIcon
  readonly label: string
  readonly tone?: 'default' | 'warning' | 'danger' | 'success'
  readonly value: number
}) => {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground',
            tone === 'warning' && 'bg-amber-500/10 text-amber-700',
            tone === 'danger' && 'bg-destructive/10 text-destructive',
            tone === 'success' && 'bg-emerald-500/10 text-emerald-700'
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  )
}
