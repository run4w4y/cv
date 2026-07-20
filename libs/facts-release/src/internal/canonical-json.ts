import { isPlainObject } from 'es-toolkit/predicate'

const encoder = new TextEncoder()

const canonicalize = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON cannot contain a non-finite number.')
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      if (item !== undefined) {
        output[key] = canonicalize(item)
      }
    }
    return output
  }

  throw new TypeError(`Canonical JSON cannot encode ${typeof value}.`)
}

export const encodeCanonicalJson = (value: unknown): Uint8Array =>
  encoder.encode(`${JSON.stringify(canonicalize(value))}\n`)
