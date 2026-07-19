import type { FilterNode } from '@cv/drizzle-query'
import type { SortingState, VisibilityState } from '@tanstack/react-table'

import type {
  SavedView,
  SavedViewsStorage,
  TableDensity,
} from '../../../table-workspace/saved-view-menu'

export type EventsTableDensity = TableDensity

export const EVENTS_SAVED_VIEWS_SCHEMA_VERSION = 2
export const EVENTS_SAVED_VIEWS_STORAGE_KEY = `@cv/application-registry/activities/saved-views@${EVENTS_SAVED_VIEWS_SCHEMA_VERSION}`

export interface EventsSavedViewState {
  readonly filters: readonly FilterNode[]
  readonly sorting: SortingState
  readonly columnVisibility: VisibilityState
  readonly density: EventsTableDensity
}

export type EventsSavedView = SavedView<EventsSavedViewState>
export type EventsSavedViewsStorage = SavedViewsStorage
