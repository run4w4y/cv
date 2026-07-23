import type { Range } from './types'

export const splitRange = (
  range: Range,
  maxDurationMs: number
): readonly Range[] => {
  const fromTimestamp = Date.parse(range.from)
  const toTimestamp = Date.parse(range.to)

  if (
    !Number.isFinite(fromTimestamp) ||
    !Number.isFinite(toTimestamp) ||
    toTimestamp <= fromTimestamp
  ) {
    throw new Error('Cloudflare analytics received a non-canonical range.')
  }

  const chunks: Range[] = []
  let cursor = fromTimestamp

  while (cursor < toTimestamp) {
    const next = Math.min(cursor + maxDurationMs, toTimestamp)

    chunks.push({
      from: new Date(cursor).toISOString(),
      to: new Date(next).toISOString(),
    })

    cursor = next
  }

  return chunks
}
