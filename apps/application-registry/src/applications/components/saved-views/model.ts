import type { FilterNode } from '@cv/drizzle-query'
import type { SortingState, VisibilityState } from '@tanstack/react-table'

import type { CompensationDisplayCurrency } from '../../model/currency'
import type {
  SavedView,
  SavedViewsStorage,
  TableDensity,
} from '../../../table-workspace/saved-view-menu'

export const APPLICATION_SAVED_VIEWS_SCHEMA_VERSION = 3
export const APPLICATION_SAVED_VIEWS_STORAGE_KEY = `@cv/application-registry/saved-views@${APPLICATION_SAVED_VIEWS_SCHEMA_VERSION}`
export const APPLICATION_WORKSPACE_STATE_SCHEMA_VERSION = 2
export const APPLICATION_WORKSPACE_STATE_STORAGE_KEY = `@cv/application-registry/workspace-state@${APPLICATION_WORKSPACE_STATE_SCHEMA_VERSION}`

export interface ApplicationSavedViewState {
  readonly keyword: string
  readonly filters: readonly FilterNode[]
  readonly sorting: SortingState
  readonly columnVisibility: VisibilityState
  readonly density: TableDensity
  readonly displayCurrency: CompensationDisplayCurrency
}

export type ApplicationSavedView = SavedView<ApplicationSavedViewState>
export type { SavedViewsStorage }
