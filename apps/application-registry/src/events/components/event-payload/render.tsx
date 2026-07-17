import { formatLabel } from '../../../lib/format'

const renderValue = (value: unknown): string => {
  if (value === null) return 'None'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(renderValue).join(', ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const eventPayloadSummary = (payload: unknown): string => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload)
  ) {
    const entries = Object.entries(payload)
    if (entries.length === 0) return 'No additional details'
    return entries
      .map(([key, value]) => `${formatLabel(key)}: ${renderValue(value)}`)
      .join(' · ')
  }
  const rendered = renderValue(payload)
  return rendered.length === 0 ? 'No additional details' : rendered
}

export const EventPayload = ({ payload }: { readonly payload: unknown }) => {
  const summary = eventPayloadSummary(payload)
  return (
    <p
      title={summary}
      className="line-clamp-3 whitespace-normal break-words text-sm/5 text-muted-foreground"
    >
      {summary}
    </p>
  )
}
