import { cloneDeepWith, mergeWith } from 'es-toolkit/object'
import { isPlainObject as isToolkitPlainObject } from 'es-toolkit/predicate'
import { isValidElement } from 'react'

const isAtomicContentValue = (value: unknown) => isValidElement(value)

export const isContentPlainObject = (
  value: unknown
): value is Record<PropertyKey, unknown> =>
  isToolkitPlainObject(value) && !isAtomicContentValue(value)

export const cloneValue = <T>(value: T): T =>
  cloneDeepWith(value, (item) =>
    isAtomicContentValue(item) ? item : undefined
  )

const mergeContentValue = (targetValue: unknown, sourceValue: unknown) => {
  if (sourceValue === undefined) {
    return cloneValue(targetValue)
  }

  if (Array.isArray(sourceValue) || isAtomicContentValue(sourceValue)) {
    return cloneValue(sourceValue)
  }

  if (
    !isContentPlainObject(targetValue) ||
    !isContentPlainObject(sourceValue)
  ) {
    return cloneValue(sourceValue)
  }

  return undefined
}

export const mergeValue = <T>(base: T, override: unknown): T => {
  const mergedValue = mergeContentValue(base, override)

  if (mergedValue !== undefined) {
    return mergedValue as T
  }

  return mergeWith(
    cloneValue(base) as Record<PropertyKey, unknown>,
    override as Record<PropertyKey, unknown>,
    mergeContentValue
  ) as T
}
