import { QueryFiltersChips } from './query-filter-chips'
import { QueryFiltersPanel, QueryFiltersToggle } from './query-filter-controls'
import {
  type QueryFiltersProps,
  QueryFiltersRoot,
} from './query-filters-context'

export { QueryFiltersChips } from './query-filter-chips'
export {
  QueryFiltersAddButton,
  QueryFiltersPanel,
  QueryFiltersToggle,
} from './query-filter-controls'
export { QueryFiltersRows } from './query-filter-rows'
export {
  type QueryFiltersProps,
  QueryFiltersRoot,
  type QueryFiltersRootProps,
} from './query-filters-context'

export const QueryFilters = (props: QueryFiltersProps) => (
  <QueryFiltersRoot {...props}>
    <div className="flex flex-wrap items-start gap-2.5">
      <div className="min-w-0 flex-1">
        <QueryFiltersChips />
      </div>
      <div className="ml-auto shrink-0">
        <QueryFiltersToggle />
      </div>
    </div>
    <QueryFiltersPanel showChips={false} />
  </QueryFiltersRoot>
)
