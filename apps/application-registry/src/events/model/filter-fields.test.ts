import { describe, expect, test } from 'bun:test'
import { applicationActivityKindValues } from '@cv/application-registry-entity'
import { activityListQuery } from '@cv/application-registry-entity/query'
import {
  createQueryFilterFields,
  descriptorForOperator,
} from '@cv/drizzle-query-ui'

import { eventFilterFieldPresentation } from './filter-fields'

describe('eventFilterFieldPresentation', () => {
  test('uses query metadata for event kinds and presentation for timestamp defaults', () => {
    const fields = createQueryFilterFields(
      activityListQuery,
      eventFilterFieldPresentation
    )
    const kind = fields.find((field) => field.name === 'kind')

    expect(kind && descriptorForOperator(kind, 'eq')).toEqual({
      type: 'enum',
      values: applicationActivityKindValues,
    })
    expect(eventFilterFieldPresentation.occurredAt?.defaultOperator).toBe('gte')
  })
})
