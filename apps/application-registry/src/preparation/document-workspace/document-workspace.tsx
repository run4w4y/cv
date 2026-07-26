import {
  Badge,
  Button,
  cn,
  Skeleton,
  Spinner,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cv/internal-ui'
import {
  Check,
  CircleAlert,
  ExternalLink,
  Eye,
  FileDiff,
  Globe2,
  MessageSquareText,
  PencilLine,
  Redo2,
  Save,
  Send,
  Undo2,
} from 'lucide-react'
import * as React from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

import { HeaderActions } from '@/shell/header-actions'

import { DocumentChangesView } from './document-changes'
import type {
  DocumentAssistant,
  DocumentAssistantMessage,
  DocumentWorkspaceAction,
  DocumentWorkspaceMode,
  DocumentWorkspaceProps,
} from './types'

const modeOptions = [
  { icon: PencilLine, label: 'Edit', value: 'edit' },
  { icon: Eye, label: 'Preview', value: 'preview' },
  { icon: FileDiff, label: 'Changes', value: 'changes' },
] as const

const DirtyNavigationGuard = () => {
  const blocker = useBlocker(true)

  useBeforeUnload((event) => {
    event.preventDefault()
    event.returnValue = ''
  })

  React.useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (
      globalThis.confirm(
        'You have unsaved document changes. Discard them and leave?'
      )
    ) {
      blocker.proceed()
      return
    }
    blocker.reset()
  }, [blocker])

  return null
}

const ToolbarIconAction = ({
  disabled,
  label,
  onClick,
  children,
}: {
  readonly children: React.ReactNode
  readonly disabled: boolean
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

const messageStatus = (
  message: DocumentAssistantMessage
): {
  label: string
  variant: 'danger' | 'outline' | 'success' | 'warning'
} | null => {
  switch (message.status) {
    case 'sending':
      return { label: 'Working', variant: 'outline' }
    case 'applied':
      return {
        label:
          message.changeCount === undefined
            ? 'Applied'
            : `${message.changeCount} ${
                message.changeCount === 1 ? 'change' : 'changes'
              }`,
        variant: 'success',
      }
    case 'stale':
      return { label: 'Draft changed', variant: 'warning' }
    case 'invalid':
      return { label: 'Not applied', variant: 'warning' }
    case 'failed':
      return { label: 'Failed', variant: 'danger' }
    case undefined:
      return null
  }
}

const AssistantMessage = ({
  message,
}: {
  readonly message: DocumentAssistantMessage
}) => {
  const status = messageStatus(message)
  return (
    <li
      className={cn(
        'text-sm/6',
        message.role === 'user'
          ? 'ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground'
          : 'w-full pr-2'
      )}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
      {status === null ? null : (
        <Badge className="mt-1.5" variant={status.variant}>
          {status.label}
        </Badge>
      )}
    </li>
  )
}

const AssistantAssessmentSkeleton = () => (
  <div
    aria-label="Codex is assessing the draft"
    className="grid gap-3 px-4 py-5"
    role="status"
  >
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-3.5" />
      Comparing this draft with the posting…
    </div>
    <Skeleton className="h-3 w-11/12" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-4/5" />
    <Skeleton className="mt-2 h-3 w-10/12" />
    <Skeleton className="h-3 w-3/4" />
  </div>
)

const AssistantRail = ({
  assistant,
  changesCount,
  disabled,
  mode,
  onModeChange,
}: {
  readonly assistant: DocumentAssistant
  readonly changesCount: number
  readonly disabled: boolean
  readonly mode: DocumentWorkspaceMode
  readonly onModeChange: (mode: DocumentWorkspaceMode) => void
}) => {
  const canSend =
    !disabled &&
    assistant.available &&
    !assistant.pending &&
    assistant.composer.trim().length > 0

  const submit = () => {
    if (!canSend) return
    void assistant.onSubmitComposer()
  }

  return (
    <aside
      aria-label="Document view and Codex"
      className="flex min-h-0 w-80 shrink-0 flex-col border-l border-border bg-card xl:w-96"
    >
      <div className="border-b border-border p-3">
        <div className="grid grid-cols-3 rounded-md bg-muted p-1">
          {modeOptions.map((option) => {
            const active = option.value === mode
            return (
              <Button
                aria-pressed={active}
                className={cn(
                  'h-8 rounded-sm px-2 text-xs',
                  active
                    ? 'bg-card text-foreground shadow-xs hover:bg-card'
                    : 'text-muted-foreground'
                )}
                key={option.value}
                type="button"
                variant="ghost"
                onClick={() => onModeChange(option.value)}
              >
                <option.icon />
                {option.label}
                {option.value === 'changes' && changesCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                    {changesCount}
                  </span>
                ) : null}
              </Button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquareText className="size-4" />
        <h2 className="text-sm font-medium">Codex review</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {assistant.messages.length > 0 ? (
          <ol aria-live="polite" className="grid content-start gap-4 px-4 py-5">
            {assistant.messages.map((message) => (
              <AssistantMessage key={message.id} message={message} />
            ))}
          </ol>
        ) : assistant.available ? (
          <AssistantAssessmentSkeleton />
        ) : (
          <div className="px-4 py-5 text-sm/6 text-muted-foreground">
            {assistant.unavailableReason ??
              'Codex is unavailable for this document.'}
          </div>
        )}
      </div>

      <form
        className="border-t border-border bg-card p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="rounded-xl border border-border bg-background p-2 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
          <Textarea
            aria-label="Message Codex"
            className="field-sizing-content min-h-16 max-h-48 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            disabled={disabled || !assistant.available || assistant.pending}
            placeholder={
              assistant.placeholder ??
              'Ask about a gap or request a focused change…'
            }
            rows={2}
            value={assistant.composer}
            onChange={(event) =>
              assistant.onComposerChange(event.currentTarget.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.ctrlKey || event.metaKey) &&
                canSend
              ) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {assistant.available
                ? disabled
                  ? 'Document is read-only'
                  : 'Ctrl ↵ to send'
                : 'Unavailable'}
            </span>
            <Button
              aria-label="Send message"
              disabled={!canSend}
              size="icon-sm"
              type="submit"
            >
              {assistant.pending ? <Spinner /> : <Send />}
            </Button>
          </div>
        </div>
      </form>
    </aside>
  )
}

const PrimaryActionIcon = ({
  action,
}: {
  readonly action: DocumentWorkspaceAction
}) => {
  if (action.pending) return <Spinner />
  switch (action.kind) {
    case 'approve':
      return <Check />
    case 'open':
      return <ExternalLink />
    case 'publish':
      return <Globe2 />
    case 'save':
      return <Save />
  }
}

const WorkspaceHeaderActions = ({
  canRedo,
  canUndo,
  disabled,
  onRedo,
  onUndo,
  postingHref,
  primaryAction,
}: Pick<
  DocumentWorkspaceProps,
  | 'canRedo'
  | 'canUndo'
  | 'disabled'
  | 'onRedo'
  | 'onUndo'
  | 'postingHref'
  | 'primaryAction'
>) => (
  <HeaderActions>
    {postingHref === undefined ? null : (
      <Button
        nativeButton={false}
        render={
          <a href={postingHref} rel="noreferrer" target="_blank">
            <ExternalLink />
            Open posting
          </a>
        }
        size="sm"
        variant="ghost"
      />
    )}
    <div className="flex items-center gap-0.5 border-l border-border pl-2">
      <ToolbarIconAction
        disabled={disabled === true || !canUndo}
        label="Undo"
        onClick={onUndo}
      >
        <Undo2 />
      </ToolbarIconAction>
      <ToolbarIconAction
        disabled={disabled === true || !canRedo}
        label="Redo"
        onClick={onRedo}
      >
        <Redo2 />
      </ToolbarIconAction>
    </div>
    <Button
      disabled={primaryAction.disabled === true}
      size="sm"
      type="button"
      onClick={() => void primaryAction.onAction()}
    >
      <PrimaryActionIcon action={primaryAction} />
      {primaryAction.pending ? `${primaryAction.label}…` : primaryAction.label}
    </Button>
  </HeaderActions>
)

export const DocumentWorkspace = ({
  assistant,
  canRedo,
  canUndo,
  changes,
  children,
  dirty,
  disabled = false,
  error = null,
  mode,
  onModeChange,
  onRedo,
  onUndo,
  postingHref,
  preview,
  previewIsStale = false,
  primaryAction,
  title,
  validationIssues,
}: DocumentWorkspaceProps) => (
  <section
    aria-label={title}
    className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
  >
    {dirty ? <DirtyNavigationGuard /> : null}
    <WorkspaceHeaderActions
      canRedo={canRedo}
      canUndo={canUndo}
      disabled={disabled}
      onRedo={onRedo}
      onUndo={onUndo}
      postingHref={postingHref}
      primaryAction={primaryAction}
    />

    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <main
        className="min-h-0 flex-1 overflow-y-auto bg-muted/35 p-4 sm:p-6"
        data-document-mode={mode}
      >
        {error === null ? null : (
          <div
            className="mx-auto mb-3 flex w-full max-w-4xl items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm/6 text-destructive"
            role="alert"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {mode === 'edit' ? children : null}
        {mode === 'preview' ? (
          <>
            {previewIsStale ? (
              <div className="mx-auto mb-3 flex w-full max-w-4xl items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs/5 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <CircleAlert className="size-4 shrink-0" />
                This is the last saved draft. Save to refresh the preview.
              </div>
            ) : null}
            {preview}
          </>
        ) : null}
        {mode === 'changes' ? (
          <DocumentChangesView
            changes={changes}
            validationIssues={validationIssues}
          />
        ) : null}
      </main>
    </div>

    <AssistantRail
      assistant={assistant}
      changesCount={changes.length}
      disabled={disabled}
      mode={mode}
      onModeChange={onModeChange}
    />
  </section>
)
