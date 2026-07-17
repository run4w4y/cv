import { eventListQuery } from '@cv/application-registry-entity/query'
import {
  normalizeQueryFilterNodes,
  parseQueryFilterNodes,
  serializeQueryFilterNodes,
} from '@cv/drizzle-query-ui'
import { Option, Schema } from 'effect'

import type { SavedViewsStorage } from '../../../table-workspace/saved-view-menu'
import {
  decodeStoredJson,
  SortingStateSchema,
  TableDensitySchema,
  VisibilityStateSchema,
} from '../../../table-workspace/saved-view-schema'
import { eventColumns } from '../events-table/columns'
import {
  EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
  EVENTS_SAVED_VIEWS_STORAGE_KEY,
  type EventsSavedView,
  type EventsSavedViewState,
} from './model'

const eventColumnIds = new Set(
  eventColumns.flatMap((column) => {
    if (typeof column.id === 'string') return [column.id]
    if ('accessorKey' in column && typeof column.accessorKey === 'string') {
      return [column.accessorKey]
    }
    return []
  })
)

const hideableEventColumnIds = new Set(
  eventColumns.flatMap((column) => {
    if (column.enableHiding === false) return []
    if (typeof column.id === 'string') return [column.id]
    if ('accessorKey' in column && typeof column.accessorKey === 'string') {
      return [column.accessorKey]
    }
    return []
  })
)

const sortableFields = new Set(
  eventListQuery.fields
    .filter((field) => field.sortable && eventColumnIds.has(field.name))
    .map((field) => field.name)
)

const RawViewStateSchema = Schema.Struct({
  filters: Schema.Unknown,
  sorting: SortingStateSchema,
  columnVisibility: VisibilityStateSchema,
  density: TableDensitySchema,
})

const RawSavedViewSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  state: RawViewStateSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const SavedViewsPayloadSchema = Schema.Struct({
  schemaVersion: Schema.Literal(EVENTS_SAVED_VIEWS_SCHEMA_VERSION),
  views: Schema.Array(Schema.Unknown),
})

const parseViewState = (
  value: Schema.Schema.Type<typeof RawViewStateSchema>
): EventsSavedViewState | null => {
  const filters = normalizeQueryFilterNodes(value.filters)
  const seen = new Set<string>()
  const sorting = value.sorting.flatMap((entry) => {
    if (!sortableFields.has(entry.id) || seen.has(entry.id)) return []
    seen.add(entry.id)
    return [{ id: entry.id, desc: entry.desc }]
  })
  if (filters === undefined || sorting.length !== value.sorting.length) {
    return null
  }
  for (const columnId of Object.keys(value.columnVisibility)) {
    if (!hideableEventColumnIds.has(columnId)) return null
  }
  return {
    filters,
    sorting,
    columnVisibility: { ...value.columnVisibility },
    density: value.density,
  }
}

const parseSavedView = (value: unknown): EventsSavedView | null => {
  const decoded = Option.getOrNull(
    Schema.decodeUnknownOption(RawSavedViewSchema)(value)
  )
  if (decoded === null || decoded.name.trim().length === 0) return null
  const state = parseViewState(decoded.state)
  return state === null
    ? null
    : {
        id: decoded.id,
        name: decoded.name,
        state,
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt,
      }
}

export const loadEventsSavedViews = (
  storage: SavedViewsStorage | null,
  storageKey = EVENTS_SAVED_VIEWS_STORAGE_KEY
): readonly EventsSavedView[] => {
  if (storage === null) return []
  const raw = storage.getItem(storageKey)
  if (raw === null) return []
  const payload = decodeStoredJson(SavedViewsPayloadSchema, raw)
  if (payload === null) return []
  return payload.views.flatMap((candidate) => {
    const view = parseSavedView(candidate)
    return view === null ? [] : [view]
  })
}

export const persistEventsSavedViews = (
  storage: SavedViewsStorage | null,
  views: readonly EventsSavedView[],
  storageKey = EVENTS_SAVED_VIEWS_STORAGE_KEY
): void => {
  if (storage === null) return
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
        views,
      })
    )
  } catch {
    // A full or disabled storage must not make the table unusable.
  }
}

export const cloneEventsViewState = (
  state: EventsSavedViewState
): EventsSavedViewState => ({
  filters:
    parseQueryFilterNodes(serializeQueryFilterNodes(state.filters) ?? '[]') ??
    [],
  sorting: state.sorting.map((entry) => ({ ...entry })),
  columnVisibility: { ...state.columnVisibility },
  density: state.density,
})

export const comparableEventsViewState = (
  state: EventsSavedViewState
): string =>
  JSON.stringify({
    ...cloneEventsViewState(state),
    columnVisibility: Object.fromEntries(
      Object.entries(state.columnVisibility).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
  })

const countFilterConditions = (
  filters: EventsSavedViewState['filters']
): number =>
  filters.reduce(
    (total, filter) =>
      total +
      (filter.type === 'condition'
        ? 1
        : countFilterConditions(filter.children)),
    0
  )

export const describeEventsViewState = (
  state: EventsSavedViewState
): string => {
  const count = countFilterConditions(state.filters)
  return `${count === 0 ? 'No filters' : `${count} ${count === 1 ? 'filter' : 'filters'}`} · ${state.density}`
}

let fallbackId = 0
export const createEventsViewId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  fallbackId += 1
  return `event-view-${Date.now().toString(36)}-${fallbackId.toString(36)}`
}
