import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components'

import { cn } from './utils'

type ReorderableRow<T> = {
  readonly id: string
  readonly item: T
  readonly textValue: string
}

export type ReorderableListProps<T> = {
  readonly ariaLabel: string
  readonly className?: string
  readonly disabled?: boolean
  readonly getKey: (item: T, index: number) => string
  readonly getTextValue: (item: T, index: number) => string
  readonly itemClassName?: string
  readonly items: ReadonlyArray<T>
  readonly onMove: (fromIndex: number, toIndex: number) => void
  readonly renderItem: (item: T, index: number) => ReactNode
}

/**
 * An accessible, keyboard-capable reorder surface for compact editor rows.
 *
 * The collection owns drag semantics only. Document identity and mutation remain
 * with the caller, so dropping a row produces the same from/to operation as any
 * other editor command.
 */
export const ReorderableList = <T,>({
  ariaLabel,
  className,
  disabled = false,
  getKey,
  getTextValue,
  itemClassName,
  items,
  onMove,
  renderItem,
}: ReorderableListProps<T>) => {
  const rows: ReadonlyArray<ReorderableRow<T>> = items.map((item, index) => ({
    id: getKey(item, index),
    item,
    textValue: getTextValue(item, index),
  }))

  const { dragAndDropHooks } = useDragAndDrop<ReorderableRow<T>>({
    isDisabled: disabled,
    getItems: (_keys, draggedRows) =>
      draggedRows.map((row) => ({
        'text/plain': row.textValue,
      })),
    onReorder: (event) => {
      const sourceKey = event.keys.values().next().value
      if (sourceKey === undefined) return

      const sourceIndex = rows.findIndex((row) => row.id === sourceKey)
      if (sourceIndex < 0) return

      const remainingRows = rows.filter((row) => row.id !== sourceKey)
      const targetIndex = remainingRows.findIndex(
        (row) => row.id === event.target.key
      )
      if (targetIndex < 0) return

      const destinationIndex =
        event.target.dropPosition === 'after' ? targetIndex + 1 : targetIndex

      if (sourceIndex !== destinationIndex) {
        onMove(sourceIndex, destinationIndex)
      }
    },
  })

  return (
    <GridList
      aria-label={ariaLabel}
      className={cn('grid outline-none', className)}
      dependencies={[items]}
      dragAndDropHooks={dragAndDropHooks}
      items={rows}
      selectionMode="none"
    >
      {(row) => {
        const index = rows.findIndex((candidate) => candidate.id === row.id)

        return (
          <GridListItem
            id={row.id}
            className={({ isDragging, isDropTarget }) =>
              cn(
                'group relative flex min-w-0 items-start gap-1 rounded-sm outline-none transition-[opacity,background-color,box-shadow]',
                'data-focus-visible:ring-2 data-focus-visible:ring-ring/30',
                isDragging && 'opacity-45',
                isDropTarget &&
                  'bg-primary/5 shadow-[inset_0_2px_0_0_var(--color-primary)]',
                itemClassName
              )
            }
            textValue={row.textValue}
          >
            <AriaButton
              aria-label={`Drag ${row.textValue}`}
              className="mt-1.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground/55 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-40"
              isDisabled={disabled}
              slot="drag"
            >
              <GripVertical className="size-4" />
            </AriaButton>
            <div className="min-w-0 flex-1">{renderItem(row.item, index)}</div>
          </GridListItem>
        )
      }}
    </GridList>
  )
}
