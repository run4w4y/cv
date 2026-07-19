import { isPlainObject } from 'es-toolkit/predicate'

import type { JsonPrimitive, JsonValue } from '../types'

export const isJsonPrimitive = (value: unknown): value is JsonPrimitive =>
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  typeof value === 'boolean'

export const isJsonValue = (value: unknown): value is JsonValue => {
  const active = new Set<object>()
  const validated = new Set<object>()

  const visit = (current: unknown): current is JsonValue => {
    if (isJsonPrimitive(current)) return true
    if (typeof current !== 'object' || current === null) return false
    if (active.has(current)) return false
    if (validated.has(current)) return true

    active.add(current)
    let valid = false
    try {
      if (Array.isArray(current)) {
        const keys = Reflect.ownKeys(current)
        const onlyArrayKeys = keys.every((key) => {
          if (key === 'length') return true
          if (typeof key !== 'string') return false
          const index = Number(key)
          return (
            Number.isInteger(index) &&
            index >= 0 &&
            index < current.length &&
            String(index) === key
          )
        })
        valid = onlyArrayKeys
        for (let index = 0; valid && index < current.length; index += 1) {
          valid = Object.hasOwn(current, index) && visit(current[index])
        }
      } else if (isPlainObject(current)) {
        const keys = Reflect.ownKeys(current)
        valid = keys.every((key) => {
          if (typeof key !== 'string') return false
          const descriptor = Object.getOwnPropertyDescriptor(current, key)
          return descriptor?.enumerable === true && visit(current[key])
        })
      }
    } catch {
      valid = false
    } finally {
      active.delete(current)
    }

    if (valid) validated.add(current)
    return valid
  }

  return visit(value)
}
