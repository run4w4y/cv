import { Effect, Schema } from 'effect'

const searchParamsRecord = (
  input: URLSearchParams | string
): Readonly<Record<string, string | readonly string[]>> => {
  const params =
    typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : input
  const result: Record<string, string | string[]> = {}

  for (const [name, value] of params) {
    const previous = result[name]
    if (previous === undefined) {
      result[name] = value
    } else if (typeof previous === 'string') {
      result[name] = [previous, value]
    } else {
      previous.push(value)
    }
  }
  return result
}

const appendSearchParam = (
  params: URLSearchParams,
  name: string,
  value: unknown
): void => {
  if (value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) params.append(name, String(item))
    return
  }
  params.append(name, String(value))
}

/** Encodes a typed query request into browser-native `URLSearchParams`. */
export const toSearchParams = <Type, Encoded extends object, RD, RE>(
  schema: Schema.Codec<Type, Encoded, RD, RE>,
  request: Type
): Effect.Effect<URLSearchParams, Schema.SchemaError, RE> =>
  Schema.encodeEffect(schema)(request).pipe(
    Effect.map((encoded) => {
      const params = new URLSearchParams()
      for (const [name, value] of Object.entries(encoded)) {
        appendSearchParam(params, name, value)
      }
      return params
    })
  )

/** Decodes a query string or `URLSearchParams` through a derived query codec. */
export const fromSearchParams = <Type, Encoded, RD, RE>(
  schema: Schema.Codec<Type, Encoded, RD, RE>,
  input: URLSearchParams | string
): Effect.Effect<Type, Schema.SchemaError, RD> =>
  Schema.decodeUnknownEffect(schema)(searchParamsRecord(input))
