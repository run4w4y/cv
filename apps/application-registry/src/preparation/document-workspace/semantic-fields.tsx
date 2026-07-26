import {
  Button,
  cn,
  Input,
  ReorderableList,
  Select,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cv/internal-ui'
import { Plus, Trash2, X } from 'lucide-react'
import type * as React from 'react'

import type { DocumentValidationIssue } from './types'

type InlineFieldTone = 'body' | 'meta' | 'subtitle' | 'title'

const fieldTone = (tone: InlineFieldTone): string => {
  switch (tone) {
    case 'title':
      return 'text-3xl/9 font-semibold tracking-tight'
    case 'subtitle':
      return 'text-base/6 font-medium'
    case 'meta':
      return 'text-xs/5 text-muted-foreground'
    case 'body':
      return 'text-sm/6'
  }
}

export const InlineTextField = ({
  className,
  disabled = false,
  issues = [],
  label,
  multiline = false,
  onChange,
  placeholder,
  tone = 'body',
  value,
}: {
  readonly className?: string
  readonly disabled?: boolean
  readonly issues?: ReadonlyArray<DocumentValidationIssue>
  readonly label: string
  readonly multiline?: boolean
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly tone?: InlineFieldTone
  readonly value: string
}) => {
  const invalid = issues.length > 0
  const shared = cn(
    'w-full border-transparent bg-transparent px-1.5 shadow-none hover:border-border hover:bg-background/70 focus-visible:bg-background',
    fieldTone(tone),
    invalid && 'border-destructive/50 bg-destructive/5',
    className
  )

  return (
    <div className="block min-w-0">
      <span className="sr-only">{label}</span>
      {multiline ? (
        <Textarea
          aria-invalid={invalid}
          aria-label={label}
          className={cn(
            'field-sizing-content min-h-9 resize-none overflow-hidden py-1.5',
            shared
          )}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : (
        <Input
          aria-invalid={invalid}
          aria-label={label}
          className={shared}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
      {invalid ? (
        <p className="mt-0.5 px-1.5 text-xs/5 text-destructive" role="alert">
          {issues[0]?.message}
        </p>
      ) : null}
    </div>
  )
}

export const ReviewedInlineValue = ({
  className,
  label,
  tone = 'body',
  value,
}: {
  readonly className?: string
  readonly label: string
  readonly tone?: InlineFieldTone
  readonly value: string
}) => (
  <div
    className={cn(
      'min-h-7 min-w-0 truncate px-1.5 py-1',
      fieldTone(tone),
      className
    )}
    title={`${value} · From reviewed facts`}
  >
    <span className="sr-only">{label}: reviewed fact. </span>
    {value}
  </div>
)

export const ReviewedFactSelect = ({
  disabled = false,
  label,
  onSelect,
  options,
}: {
  readonly disabled?: boolean
  readonly label: string
  readonly onSelect: (id: string) => void
  readonly options: ReadonlyArray<{
    readonly id: string
    readonly label: string
  }>
}) =>
  options.length === 0 ? null : (
    <Select
      ariaLabel={label}
      className="h-7 max-w-64 border-dashed px-2 text-xs text-muted-foreground"
      disabled={disabled}
      onValueChange={(id) => {
        if (id !== null) onSelect(id)
      }}
      options={options.map((option) => ({
        label: option.label,
        value: option.id,
      }))}
      placeholder={`${label}…`}
      value={null}
      variant="ghost"
    />
  )

const IconAction = ({
  disabled,
  label,
  onClick,
  children,
}: {
  readonly children: React.ReactNode
  readonly disabled?: boolean
  readonly label: string
  readonly onClick: () => void
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          aria-label={label}
          disabled={disabled}
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={onClick}
        >
          {children}
        </Button>
      }
    />
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

export const RowActions = ({
  disabled = false,
  label,
  onRemove,
}: {
  readonly disabled?: boolean
  readonly label: string
  readonly onRemove: () => void
}) => (
  <div className="flex shrink-0 items-center gap-0.5 opacity-45 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
    <IconAction
      disabled={disabled}
      label={`Remove ${label}`}
      onClick={onRemove}
    >
      <Trash2 />
    </IconAction>
  </div>
)

export const AddRowButton = ({
  disabled = false,
  label,
  onClick,
}: {
  readonly disabled?: boolean
  readonly label: string
  readonly onClick: () => void
}) => (
  <Button
    className="h-7 border-dashed text-muted-foreground"
    disabled={disabled}
    size="sm"
    type="button"
    variant="outline"
    onClick={onClick}
  >
    <Plus />
    {label}
  </Button>
)

export const SectionHeading = ({
  action,
  children,
}: {
  readonly action?: React.ReactNode
  readonly children: React.ReactNode
}) => (
  <div className="flex items-end justify-between gap-3 border-b border-foreground/20 pb-1.5">
    <h2 className="text-xs/5 font-semibold tracking-[0.16em] uppercase">
      {children}
    </h2>
    {action}
  </div>
)

export const DocumentPaper = ({
  children,
  className,
  label,
}: {
  readonly children: React.ReactNode
  readonly className?: string
  readonly label: string
}) => (
  <article
    aria-label={label}
    className={cn(
      'mx-auto min-h-full w-full max-w-4xl bg-card px-8 py-10 text-card-foreground shadow-sm ring-1 ring-border sm:px-12 lg:px-16',
      className
    )}
  >
    {children}
  </article>
)

export const BulletListEditor = ({
  disabled = false,
  issuesForIndex,
  label,
  onAdd,
  onChange,
  onMove,
  onRemove,
  values,
}: {
  readonly disabled?: boolean
  readonly issuesForIndex?: (
    index: number
  ) => ReadonlyArray<DocumentValidationIssue>
  readonly label: string
  readonly onAdd: () => void
  readonly onChange: (index: number, value: string) => void
  readonly onMove: (fromIndex: number, toIndex: number) => void
  readonly onRemove: (index: number) => void
  readonly values: ReadonlyArray<string>
}) => (
  <div className="grid gap-1.5">
    <ReorderableList
      ariaLabel={`Reorder ${label.toLowerCase()}s`}
      className="gap-1"
      disabled={disabled || values.length < 2}
      getKey={(_, index) => `${label}:${index}`}
      getTextValue={(value, index) => value || `${label} ${index + 1}`}
      items={values}
      onMove={onMove}
      renderItem={(value, index) => (
        <div className="group flex items-start gap-1">
          <span
            aria-hidden
            className="mt-3.5 size-1.5 shrink-0 rounded-full bg-foreground/55"
          />
          <div className="min-w-0 flex-1">
            <InlineTextField
              className="min-h-8 py-1"
              disabled={disabled}
              issues={issuesForIndex?.(index)}
              label={`${label} ${index + 1}`}
              multiline
              onChange={(next) => onChange(index, next)}
              placeholder="Add a concise, evidence-backed point"
              value={value}
            />
          </div>
          <RowActions
            disabled={disabled}
            label={`${label.toLowerCase()} ${index + 1}`}
            onRemove={() => onRemove(index)}
          />
        </div>
      )}
    />
    <AddRowButton
      disabled={disabled}
      label={`Add ${label.toLowerCase()}`}
      onClick={onAdd}
    />
  </div>
)

export const TagListEditor = ({
  disabled = false,
  label,
  onAdd,
  onChange,
  onRemove,
  values,
}: {
  readonly disabled?: boolean
  readonly label: string
  readonly onAdd: () => void
  readonly onChange: (index: number, value: string) => void
  readonly onRemove: (index: number) => void
  readonly values: ReadonlyArray<string>
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {values.map((value, index) => (
      <label
        className="flex h-7 items-center gap-0.5 rounded-full border border-border bg-muted/50 pl-2.5"
        // biome-ignore lint/suspicious/noArrayIndexKey: Primitive document arrays may contain duplicate strings and have no stable item identity.
        key={`${label}-${index}`}
      >
        <span className="sr-only">
          {label} {index + 1}
        </span>
        <input
          aria-label={`${label} ${index + 1}`}
          className="w-24 bg-transparent text-xs outline-none"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(index, event.currentTarget.value)}
        />
        <Button
          aria-label={`Remove ${value || label}`}
          className="size-6 rounded-full"
          disabled={disabled}
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={() => onRemove(index)}
        >
          <X className="size-3" />
        </Button>
      </label>
    ))}
    <Button
      aria-label={`Add ${label.toLowerCase()}`}
      className="size-7 rounded-full border-dashed"
      disabled={disabled}
      size="icon-sm"
      type="button"
      variant="outline"
      onClick={onAdd}
    >
      <Plus className="size-3" />
    </Button>
  </div>
)
