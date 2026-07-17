import {
  appendOperators,
  cursorPagination,
  defineQuery,
  type QueryRequestOf,
} from '@cv/drizzle-query'
import { applicationEventKindValues } from '../model/values'
import { applicationEvents } from '../tables/events'
import { timestampFilterOperators } from './timestamp-filter-operators'

/** Authoritative filtering, ordering, and cursor contract for registry events. */
export const eventListQuery = defineQuery(
  applicationEvents,
  ({ col }) => [
    col.id.filterable().sortable(),
    col.applicationId.filterable().sortable(),
    col.kind.filterable().sortable({ values: applicationEventKindValues }),
    col.revision.filterable().sortable({ unique: true }),
    col.occurredAt
      .filterable((defaults) =>
        appendOperators(defaults, timestampFilterOperators)
      )
      .sortable(),
    col.recordedAt
      .filterable((defaults) =>
        appendOperators(defaults, timestampFilterOperators)
      )
      .sortable(),
    col.deviceId.filterable().sortable(),
    col.operationId.filterable().sortable(),
  ],
  {
    cursor: { revision: 'registry-events-list-v3' },
    defaultOrderBy: [{ field: 'revision', direction: 'asc' }],
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
  }
)

/** Typed request inferred from {@link eventListQuery}. */
export type EventListQueryRequest = QueryRequestOf<typeof eventListQuery>
