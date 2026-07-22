import {
  type QueryLanguageIssue,
  type QueryLanguageResult,
  queryLanguageFailure,
  queryLanguageSuccess,
} from './types'

const jsonNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u
const bareString = /^[^\s;|!()[\]{},"\\]+$/u
const bareIdentifier = /^[A-Za-z_][A-Za-z0-9_.-]*$/u

export const isBareQueryLanguageIdentifier = (value: string): boolean =>
  bareIdentifier.test(value)

export const formatQueryLanguageIdentifier = (value: string): string =>
  isBareQueryLanguageIdentifier(value) ? value : JSON.stringify(value)

export const valueFromBareQueryLanguageLiteral = (value: string): unknown => {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (jsonNumber.test(value)) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return value
}

const canFormatBareString = (value: string): boolean =>
  bareString.test(value) &&
  value !== 'true' &&
  value !== 'false' &&
  value !== 'null' &&
  !jsonNumber.test(value)

const unsupportedValue = (message: string): QueryLanguageResult<string> =>
  queryLanguageFailure({ code: 'unsupported-value', message })

/** Formats the JSON-like operand subset supported by compact query syntax. */
export const formatQueryLanguageValue = (
  value: unknown,
  ancestors: ReadonlySet<object> = new Set()
): QueryLanguageResult<string> => {
  if (value === null) return queryLanguageSuccess('null')
  if (typeof value === 'string') {
    return queryLanguageSuccess(
      canFormatBareString(value) ? value : JSON.stringify(value)
    )
  }
  if (typeof value === 'boolean') {
    return queryLanguageSuccess(value ? 'true' : 'false')
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? queryLanguageSuccess(String(value))
      : unsupportedValue(
          'Compact query operands cannot contain non-finite numbers.'
        )
  }
  if (typeof value === 'bigint') {
    return queryLanguageSuccess(JSON.stringify(value.toString()))
  }
  if (typeof value !== 'object') {
    return unsupportedValue(
      `Compact query operands cannot contain values of type ${typeof value}.`
    )
  }
  if (ancestors.has(value)) {
    return unsupportedValue('Compact query operands cannot contain cycles.')
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  if (Array.isArray(value)) {
    const items: string[] = []
    for (const item of value) {
      const formatted = formatQueryLanguageValue(item, nextAncestors)
      if (!formatted.ok) return formatted
      items.push(formatted.value)
    }
    return queryLanguageSuccess(`[${items.join(',')}]`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return unsupportedValue(
      'Compact query operands can only contain arrays and plain objects.'
    )
  }

  const fields: string[] = []
  for (const [name, fieldValue] of Object.entries(value)) {
    const formatted = formatQueryLanguageValue(fieldValue, nextAncestors)
    if (!formatted.ok) return formatted
    fields.push(`${formatQueryLanguageIdentifier(name)}:${formatted.value}`)
  }
  return queryLanguageSuccess(`{${fields.join(',')}}`)
}

export type QueryLanguageScanner = {
  readonly input: string
  index: number
  skipWhitespace: () => void
  issue: (issue: Omit<QueryLanguageIssue, 'offset'>) => QueryLanguageIssue
}

export const makeQueryLanguageScanner = (
  input: string
): QueryLanguageScanner => {
  const scanner: QueryLanguageScanner = {
    input,
    index: 0,
    skipWhitespace: () => {
      while (/\s/u.test(input[scanner.index] ?? '')) scanner.index += 1
    },
    issue: (issue) => ({ ...issue, offset: scanner.index }),
  }
  return scanner
}

const parseJsonString = (
  scanner: QueryLanguageScanner
): QueryLanguageResult<string> => {
  const start = scanner.index
  scanner.index += 1
  let escaped = false
  while (scanner.index < scanner.input.length) {
    const character = scanner.input[scanner.index]
    scanner.index += 1
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (character === '"') {
      const encoded = scanner.input.slice(start, scanner.index)
      try {
        const decoded: unknown = JSON.parse(encoded)
        return typeof decoded === 'string'
          ? queryLanguageSuccess(decoded)
          : queryLanguageFailure(
              scanner.issue({
                code: 'invalid-literal',
                message: 'Expected a JSON string.',
              })
            )
      } catch {
        return queryLanguageFailure({
          code: 'invalid-literal',
          message: 'Invalid JSON string escape sequence.',
          offset: start,
        })
      }
    }
  }
  return queryLanguageFailure({
    code: 'invalid-literal',
    message: 'Unterminated JSON string.',
    offset: start,
  })
}

export const parseQueryLanguageIdentifier = (
  scanner: QueryLanguageScanner
): QueryLanguageResult<string> => {
  scanner.skipWhitespace()
  if (scanner.input[scanner.index] === '"') return parseJsonString(scanner)

  const start = scanner.index
  while (
    scanner.index < scanner.input.length &&
    /[A-Za-z0-9_.-]/u.test(scanner.input[scanner.index] ?? '')
  ) {
    scanner.index += 1
  }
  const value = scanner.input.slice(start, scanner.index)
  return isBareQueryLanguageIdentifier(value)
    ? queryLanguageSuccess(value)
    : queryLanguageFailure({
        code: 'expected-token',
        message: 'Expected an identifier.',
        offset: start,
      })
}

const parseBareValue = (
  scanner: QueryLanguageScanner
): QueryLanguageResult<unknown> => {
  const start = scanner.index
  while (
    scanner.index < scanner.input.length &&
    !/[\s;|!()[\]{},"\\]/u.test(scanner.input[scanner.index] ?? '')
  ) {
    scanner.index += 1
  }
  const value = scanner.input.slice(start, scanner.index)
  return value.length === 0
    ? queryLanguageFailure({
        code: 'invalid-literal',
        message: 'Expected a query operand.',
        offset: start,
      })
    : queryLanguageSuccess(valueFromBareQueryLanguageLiteral(value))
}

const expectCharacter = (
  scanner: QueryLanguageScanner,
  character: string
): QueryLanguageResult<void> => {
  scanner.skipWhitespace()
  if (scanner.input[scanner.index] !== character) {
    return queryLanguageFailure(
      scanner.issue({
        code: 'expected-token',
        message: `Expected "${character}".`,
      })
    )
  }
  scanner.index += 1
  return queryLanguageSuccess(undefined)
}

export const parseQueryLanguageValue = (
  scanner: QueryLanguageScanner,
  depth = 1
): QueryLanguageResult<unknown> => {
  if (depth > 12) {
    return queryLanguageFailure(
      scanner.issue({
        code: 'expression-too-deep',
        message: 'Compact query operands may be nested at most 12 levels.',
      })
    )
  }
  scanner.skipWhitespace()
  const character = scanner.input[scanner.index]
  if (character === '"') return parseJsonString(scanner)

  if (character === '[') {
    scanner.index += 1
    scanner.skipWhitespace()
    const items: unknown[] = []
    if (scanner.input[scanner.index] === ']') {
      scanner.index += 1
      return queryLanguageSuccess(items)
    }
    while (true) {
      const item = parseQueryLanguageValue(scanner, depth + 1)
      if (!item.ok) return item
      items.push(item.value)
      scanner.skipWhitespace()
      if (scanner.input[scanner.index] === ']') {
        scanner.index += 1
        return queryLanguageSuccess(items)
      }
      const comma = expectCharacter(scanner, ',')
      if (!comma.ok) return comma
    }
  }

  if (character === '{') {
    scanner.index += 1
    scanner.skipWhitespace()
    const fields: Array<readonly [string, unknown]> = []
    const names = new Set<string>()
    if (scanner.input[scanner.index] === '}') {
      scanner.index += 1
      return queryLanguageSuccess(Object.fromEntries(fields))
    }
    while (true) {
      const name = parseQueryLanguageIdentifier(scanner)
      if (!name.ok) return name
      if (names.has(name.value)) {
        return queryLanguageFailure(
          scanner.issue({
            code: 'duplicate-field',
            message: `Duplicate object field "${name.value}".`,
          })
        )
      }
      names.add(name.value)
      const colon = expectCharacter(scanner, ':')
      if (!colon.ok) return colon
      const field = parseQueryLanguageValue(scanner, depth + 1)
      if (!field.ok) return field
      fields.push([name.value, field.value])
      scanner.skipWhitespace()
      if (scanner.input[scanner.index] === '}') {
        scanner.index += 1
        return queryLanguageSuccess(Object.fromEntries(fields))
      }
      const comma = expectCharacter(scanner, ',')
      if (!comma.ok) return comma
    }
  }

  return parseBareValue(scanner)
}
