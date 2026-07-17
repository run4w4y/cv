import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cv/internal-ui'
import type { Table as TanStackTable } from '@tanstack/react-table'
import { Bookmark, Check, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import * as React from 'react'

import { SavedViewDialog } from './saved-view-dialog'
import type { SavedView, SavedViewCopy, TableDensity } from './saved-view-model'
import { TableViewSettings } from './table-view-settings'

type EditorState =
  | { readonly kind: 'create' }
  | { readonly kind: 'rename'; readonly viewId: string }

export const SavedViewMenu = <
  Row,
  State extends { readonly density: TableDensity },
>({
  views,
  setViews,
  currentState,
  onApply,
  cloneState,
  comparableState,
  createId,
  describeState,
  table,
  density,
  onDensityChange,
  className,
  copy,
}: {
  readonly views: readonly SavedView<State>[]
  readonly setViews: React.Dispatch<
    React.SetStateAction<readonly SavedView<State>[]>
  >
  readonly currentState: State
  readonly onApply: (state: State) => void
  readonly cloneState: (state: State) => State
  readonly comparableState: (state: State) => string
  readonly createId: () => string
  readonly describeState: (state: State) => string
  readonly table?: TanStackTable<Row>
  readonly density?: TableDensity
  readonly onDensityChange?: (density: TableDensity) => void
  readonly className?: string
  readonly copy: SavedViewCopy
}) => {
  const [open, setOpen] = React.useState(false)
  const [editor, setEditor] = React.useState<EditorState | null>(null)
  const [viewName, setViewName] = React.useState('')
  const [nameError, setNameError] = React.useState<string | null>(null)
  const currentComparable = comparableState(currentState)
  const activeViewId = views.find(
    (view) => comparableState(view.state) === currentComparable
  )?.id

  const closeEditor = () => {
    setEditor(null)
    setViewName('')
    setNameError(null)
  }
  const beginCreate = () => {
    setOpen(false)
    setEditor({ kind: 'create' })
    setViewName('')
    setNameError(null)
  }
  const beginRename = (view: SavedView<State>) => {
    setOpen(false)
    setEditor({ kind: 'rename', viewId: view.id })
    setViewName(view.name)
    setNameError(null)
  }
  const submitEditor = () => {
    if (editor === null) return
    const name = viewName.trim()
    if (name.length === 0) {
      setNameError('Enter a name for this view.')
      return
    }
    if (
      views.some(
        (view) =>
          view.id !== (editor.kind === 'rename' ? editor.viewId : undefined) &&
          view.name.localeCompare(name, undefined, {
            sensitivity: 'accent',
          }) === 0
      )
    ) {
      setNameError('A saved view with this name already exists.')
      return
    }
    const now = new Date().toISOString()
    setViews((current) =>
      editor.kind === 'create'
        ? [
            ...current,
            {
              id: createId(),
              name,
              state: cloneState(currentState),
              createdAt: now,
              updatedAt: now,
            },
          ]
        : current.map((view) =>
            view.id === editor.viewId ? { ...view, name, updatedAt: now } : view
          )
    )
    closeEditor()
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={className}
            >
              <Settings2 />
              View
              {views.length > 0 ? (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {views.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <PopoverContent
          align="end"
          className="w-88 max-w-[calc(100vw-2rem)] p-0"
        >
          {table !== undefined &&
          density !== undefined &&
          onDensityChange !== undefined ? (
            <TableViewSettings
              table={table}
              density={density}
              onDensityChange={onDensityChange}
            />
          ) : null}
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold">Saved views</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {copy.restoreDescription}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {views.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Bookmark className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No saved views yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.emptyDescription}
                </p>
              </div>
            ) : (
              views.map((view) => {
                const active = view.id === activeViewId
                return (
                  <div
                    key={view.id}
                    className="flex items-center gap-1 rounded-md p-1 hover:bg-muted/70"
                  >
                    <button
                      type="button"
                      aria-label={`Apply ${view.name}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        onApply(cloneState(view.state))
                        setOpen(false)
                      }}
                      className={cn(
                        'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                        active && 'text-primary'
                      )}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {active ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {view.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {describeState(view.state)}
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${view.name}`}
                      title={`Rename ${view.name}`}
                      onClick={() => beginRename(view)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${view.name}`}
                      title={`Delete ${view.name}`}
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setViews((current) =>
                          current.filter((entry) => entry.id !== view.id)
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-border p-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={beginCreate}
            >
              <Plus />
              Save current view
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <SavedViewDialog
        mode={editor?.kind ?? null}
        name={viewName}
        error={nameError}
        copy={copy}
        onNameChange={(name) => {
          setViewName(name)
          if (nameError !== null) setNameError(null)
        }}
        onClose={closeEditor}
        onSubmit={submitEditor}
      />
    </>
  )
}

export {
  defaultSavedViewsStorage,
  type SavedView,
  type SavedViewsStorage,
  type TableDensity,
  usePersistentSavedViews,
} from './saved-view-model'
