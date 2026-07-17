export type QuerySearchParamsInput =
  | URLSearchParams
  | string
  | Readonly<Record<string, string | readonly string[] | undefined>>

const toSearchParams = (input: URLSearchParams | string): URLSearchParams =>
  typeof input === 'string'
    ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
    : input

/** Preserves duplicate query parameters as arrays for runtime decoders. */
export const queryParamsRecord = (
  input: URLSearchParams | string
): Readonly<Record<string, string | readonly string[]>> => {
  const result: Record<string, string | string[]> = {}
  for (const [name, value] of toSearchParams(input)) {
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

/** Reads all values for one parameter from browser or record input. */
export const queryParamValues = (
  input: Exclude<QuerySearchParamsInput, string>,
  name: string
): readonly string[] => {
  if (input instanceof URLSearchParams) return input.getAll(name)
  const value = input[name]
  if (value === undefined) return []
  return typeof value === 'string' ? [value] : value
}

/** Appends one encoded record field using repeated parameters for arrays. */
export const appendQueryParam = (
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

/** Encodes a flat record into browser-native query parameters. */
export const queryParamsFromRecord = (encoded: object): URLSearchParams => {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(encoded)) {
    appendQueryParam(params, name, value)
  }
  return params
}

/** Replaces one parameter while preserving unrelated URL state. */
export const replaceQueryParam = (
  input: URLSearchParams,
  name: string,
  value: string | undefined
): URLSearchParams => {
  const next = new URLSearchParams(input)
  next.delete(name)
  if (value !== undefined) next.set(name, value)
  return next
}
