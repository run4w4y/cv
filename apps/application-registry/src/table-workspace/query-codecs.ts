import {
  decodeListActivitiesSearchParams,
  decodeListApplicationsSearchParams,
  encodeListActivitiesSearchParams,
  encodeListApplicationsSearchParams,
  type ListActivitiesQuery,
  type ListApplicationsQuery,
} from '@cv/application-registry-api-contract'
import type { QuerySearchParamsBoundary } from '@cv/drizzle-query-ui/search-params'

const genericQueryKeys = ['filter', 'sort', 'after', 'size'] as const

export const applicationQueryBoundary: QuerySearchParamsBoundary<ListApplicationsQuery> =
  {
    decode: decodeListApplicationsSearchParams,
    encode: encodeListApplicationsSearchParams,
    ownedKeys: new Set([...genericQueryKeys, 'q']),
  }

export const activityQueryBoundary: QuerySearchParamsBoundary<ListActivitiesQuery> =
  {
    decode: decodeListActivitiesSearchParams,
    encode: encodeListActivitiesSearchParams,
    ownedKeys: new Set(genericQueryKeys),
  }
