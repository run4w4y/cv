import { Effect } from 'effect'

import { FactsReleaseValidationError } from '../errors'

const encoder = new TextEncoder()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

  if (isRecord(value)) {
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

export const encodeCanonicalJson = (
  value: unknown,
  context: 'catalogue' | 'manifest'
): Effect.Effect<Uint8Array, FactsReleaseValidationError> =>
  Effect.try({
    try: () => encoder.encode(`${JSON.stringify(canonicalize(value))}\n`),
    catch: (cause) =>
      new FactsReleaseValidationError({
        cause,
        context,
        message: `Could not encode the facts release ${context} as canonical JSON.`,
      }),
  })
