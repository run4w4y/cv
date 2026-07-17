import { dateFilterValueLabel, isDateRangeDescriptor } from './date-value'
import {
  descriptorForOperator,
  type EditableFilterCondition,
  type QueryFilterField,
} from './model'

export const conditionValueLabel = (
  condition: EditableFilterCondition,
  field: QueryFilterField
): string => {
  const operator = field.filterOperatorInfo.find(
    (candidate) => candidate.name === condition.operator
  )
  if (operator?.kind === 'unary') return ''
  const descriptor = descriptorForOperator(field, condition.operator)
  const values = Array.isArray(condition.value)
    ? condition.value
    : [condition.value]

  return values
    .map((value, index) => {
      const option = field.options.find((item) => item.value === value)
      if (option !== undefined) return option.label
      if (
        descriptor?.type === 'date' ||
        (descriptor !== undefined &&
          isDateRangeDescriptor(descriptor) &&
          descriptor.items[index]?.type === 'date')
      ) {
        return dateFilterValueLabel(value) ?? String(value ?? '')
      }
      return String(value ?? '')
    })
    .filter(Boolean)
    .join(', ')
}

export const keyConditions = (
  conditions: readonly EditableFilterCondition[]
): readonly {
  readonly condition: EditableFilterCondition
  readonly index: number
  readonly key: string
}[] => {
  const occurrences = new Map<string, number>()
  return conditions.map((condition, index) => {
    const occurrence = occurrences.get(condition.field) ?? 0
    occurrences.set(condition.field, occurrence + 1)
    return {
      condition,
      index,
      key: `${condition.field}:${occurrence}`,
    }
  })
}
