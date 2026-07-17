import { describe, expect, test } from 'bun:test'
import {
  applicationStatusValues,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { applicationListQuery } from '@cv/application-registry-entity/query'
import {
  conditionForField,
  createQueryFilterFields,
  descriptorForOperator,
} from '@cv/drizzle-query-ui'

import { createApplicationFilterFieldPresentation } from './filter-fields'

describe('application filter fields', () => {
  test('defaults registry timestamps to a calendar-backed comparison', () => {
    const field = createQueryFilterFields(
      applicationListQuery,
      createApplicationFilterFieldPresentation()
    ).find((candidate) => candidate.name === 'followUpAt')
    const now = new Date('2026-07-20T09:30:00.000Z')

    expect(field?.defaultOperator).toBe('gte')
    expect(field && conditionForField(field, () => now)).toEqual({
      type: 'condition',
      field: 'followUpAt',
      operator: 'gte',
      value: now.toISOString(),
    })
    expect(field && descriptorForOperator(field, 'gte')).toEqual({
      type: 'date',
    })
  })

  test('uses every timestamp operator from authoritative query metadata', () => {
    const field = createQueryFilterFields(
      applicationListQuery,
      createApplicationFilterFieldPresentation()
    ).find((candidate) => candidate.name === 'updatedAt')

    expect(field?.defaultOperator).toBe('gte')
    expect(
      field?.filterOperatorInfo.some((operator) => operator.name === 'gte')
    ).toBe(true)
    expect(
      field?.filterOperatorInfo.some((operator) => operator.name === 'between')
    ).toBe(true)
  })

  test('exposes range calendars for timestamp fields from query metadata', () => {
    const fields = createQueryFilterFields(
      applicationListQuery,
      createApplicationFilterFieldPresentation()
    )

    for (const name of [
      'appliedAt',
      'createdAt',
      'followUpAt',
      'lastContactAt',
      'latestEventAt',
      'listingCheckedAt',
      'listingClosedCandidateAt',
      'updatedAt',
    ]) {
      const field = fields.find((candidate) => candidate.name === name)
      expect(field && descriptorForOperator(field, 'between')).toEqual({
        type: 'tuple',
        items: [{ type: 'date' }, { type: 'date' }],
      })
    }
  })

  test('derives closed enum values from query metadata', () => {
    const fields = createQueryFilterFields(
      applicationListQuery,
      createApplicationFilterFieldPresentation()
    )

    for (const [name, values] of [
      ['applicationStatus', applicationStatusValues],
      ['personalPriority', personalPriorityValues],
      ['targetStage', targetStageValues],
    ] as const) {
      const field = fields.find((candidate) => candidate.name === name)
      expect(field && descriptorForOperator(field, 'eq')).toEqual({
        type: 'enum',
        values,
      })
    }
  })
})
