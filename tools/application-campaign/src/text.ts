export const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 20)).trimEnd()}\n\n[truncated]`
    : value

export const slugify = (value: string, fallback = 'application') => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80)

  return slug || fallback
}
