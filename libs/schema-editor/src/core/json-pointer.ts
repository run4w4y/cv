const escapeSegment = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1')

export const toJsonPointer = (path: ReadonlyArray<string | number>): string =>
  path.map((segment) => `/${escapeSegment(String(segment))}`).join('')

export const appendJsonPointer = (
  pointer: string,
  segment: string | number
): string => `${pointer}/${escapeSegment(String(segment))}`
