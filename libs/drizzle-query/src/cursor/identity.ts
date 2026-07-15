import { hash } from 'ohash'

const cursorIdentity = (prefix: string, value: unknown): string => {
  return `${prefix}:${hash(value)}`
}

/** Identifies the query definition that controls cursor compatibility. */
export const cursorDefinitionIdentity = (value: unknown): string =>
  cursorIdentity('d2', value)

/** Identifies the definition and request inputs represented by a cursor. */
export const cursorQueryIdentity = (value: unknown): string =>
  cursorIdentity('q2', value)
