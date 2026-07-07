import { isPlainObject } from 'es-toolkit/predicate'

export const readRecord = (
  value: Readonly<Record<string, unknown>>,
  key: string
) => {
  const child = value[key]

  return isPlainObject(child) ? child : undefined
}

export const readArray = (
  value: Readonly<Record<string, unknown>>,
  key: string
) => {
  const child = value[key]

  return Array.isArray(child) ? child : []
}

export const readString = (
  value: Readonly<Record<string, unknown>>,
  key: string
) => {
  const child = value[key]

  return typeof child === 'string' && child.trim() ? child.trim() : undefined
}
