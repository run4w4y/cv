import { isPlainObject } from 'es-toolkit/predicate'

import { cursorError } from './errors'
import type {
  CursorScalar,
  CursorValueDescriptor,
  CursorValueType,
  SerializedCursorScalar,
} from './types'

export const serializeCursorScalar = (
  value: unknown,
  path?: string
): SerializedCursorScalar => {
  if (value === null) {
    return { type: 'null' }
  }

  switch (typeof value) {
    case 'string':
      return { type: 'string', value }
    case 'number':
      if (!Number.isFinite(value)) {
        throw cursorError(
          'invalid-cursor',
          'Cursor numbers must be finite.',
          path
        )
      }
      return { type: 'number', value }
    case 'boolean':
      return { type: 'boolean', value }
    case 'bigint':
      return { type: 'bigint', value: value.toString(10) }
    case 'object':
      if (value instanceof Date && Number.isFinite(value.getTime())) {
        return { type: 'date', value: value.toISOString() }
      }
      break
  }

  throw cursorError(
    'invalid-cursor',
    'Cursor values must be null, strings, finite numbers, booleans, bigints, or valid Dates.',
    path
  )
}

export const isSerializedCursorScalar = (
  value: unknown
): value is SerializedCursorScalar => {
  if (!isPlainObject(value) || typeof value.type !== 'string') {
    return false
  }

  if (value.type === 'null') {
    return true
  }

  switch (value.type) {
    case 'string':
      return typeof value.value === 'string'
    case 'number':
      return typeof value.value === 'number' && Number.isFinite(value.value)
    case 'boolean':
      return typeof value.value === 'boolean'
    case 'bigint':
      if (
        typeof value.value !== 'string' ||
        !/^(?:0|-?[1-9][0-9]*)$/u.test(value.value)
      ) {
        return false
      }
      return true
    case 'date': {
      if (typeof value.value !== 'string') {
        return false
      }
      const date = new Date(value.value)
      return (
        Number.isFinite(date.getTime()) && date.toISOString() === value.value
      )
    }
    default:
      return false
  }
}

export const deserializeCursorScalar = (
  value: SerializedCursorScalar
): CursorScalar => {
  switch (value.type) {
    case 'null':
      return null
    case 'string':
    case 'number':
    case 'boolean':
      return value.value
    case 'bigint':
      return BigInt(value.value)
    case 'date':
      return new Date(value.value)
  }
}

const descriptorParts = (
  descriptor: CursorValueDescriptor
): { readonly type: CursorValueType; readonly nullable: boolean } =>
  typeof descriptor === 'string'
    ? { type: descriptor, nullable: false }
    : descriptor

export const matchesDescriptor = (
  value: SerializedCursorScalar,
  descriptor: CursorValueDescriptor
): boolean => {
  const expected = descriptorParts(descriptor)
  return value.type === 'null'
    ? expected.nullable
    : value.type === expected.type
}
