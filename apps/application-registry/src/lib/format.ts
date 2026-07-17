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
