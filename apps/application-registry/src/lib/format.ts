const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const formatDateTime = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

export const formatLabel = (value: string): string =>
  value
    .replaceAll('_', ' ')
    .replace(/^./u, (character) => character.toLocaleUpperCase('en-US'))

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const
const byteSizeFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
})

export const formatByteSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value === 0) return '0 B'
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    byteUnits.length - 1
  )
  return `${byteSizeFormatter.format(value / 1024 ** unitIndex)} ${
    byteUnits[unitIndex]
  }`
}
