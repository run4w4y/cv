import type { FilterValueDescriptor } from '@cv/drizzle-query'

export type ResolvedDescriptorValue =
  | { readonly valid: true; readonly value: unknown }
  | { readonly valid: false }

const invalidDescriptorValue: ResolvedDescriptorValue = { valid: false }

const hasUsableUnknownValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  return true
}

const canonicalDateValue = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }
  if (typeof value !== 'string' || value.length === 0) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  const canonical = date.toISOString()
  return canonical === value ? canonical : undefined
}

/** Resolves one editor value to the canonical query operand representation. */
export const resolveDescriptorValue = (
  descriptor: FilterValueDescriptor,
  value: unknown
): ResolvedDescriptorValue => {
  switch (descriptor.type) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'bigint':
      if (typeof value === 'bigint') {
        return { valid: true, value: value.toString() }
      }
      return typeof value === 'string' && /^-?\d+$/u.test(value)
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'boolean':
      return typeof value === 'boolean'
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'date': {
      const canonical = canonicalDateValue(value)
      return canonical === undefined
        ? invalidDescriptorValue
        : { valid: true, value: canonical }
    }
    case 'enum':
      return typeof value === 'string' && descriptor.values.includes(value)
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'unknown':
      return hasUsableUnknownValue(value)
        ? { valid: true, value }
        : invalidDescriptorValue
    case 'array': {
      if (!Array.isArray(value) || value.length === 0) {
        return invalidDescriptorValue
      }
      const items = value.map((item) =>
        resolveDescriptorValue(descriptor.item, item)
      )
      return items.every(
        (item): item is Extract<ResolvedDescriptorValue, { valid: true }> =>
          item.valid
      )
        ? { valid: true, value: items.map((item) => item.value) }
        : invalidDescriptorValue
    }
    case 'tuple': {
      if (!Array.isArray(value) || value.length !== descriptor.items.length) {
        return invalidDescriptorValue
      }
      const items = descriptor.items.map((item, index) =>
        resolveDescriptorValue(item, value[index])
      )
      return items.every(
        (item): item is Extract<ResolvedDescriptorValue, { valid: true }> =>
          item.valid
      )
        ? { valid: true, value: items.map((item) => item.value) }
        : invalidDescriptorValue
    }
    case 'struct': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return invalidDescriptorValue
      }
      const fields = Object.entries(descriptor.fields).map(
        ([name, fieldDescriptor]) =>
          [
            name,
            resolveDescriptorValue(fieldDescriptor, Reflect.get(value, name)),
          ] as const
      )
      return fields.every(([, field]) => field.valid)
        ? {
            valid: true,
            value: Object.fromEntries(
              fields.map(([name, field]) => [
                name,
                field.valid ? field.value : undefined,
              ])
            ),
          }
        : invalidDescriptorValue
    }
  }
}
