/** Canonical server-side representation used for posting deduplication. */
export const normalizeApplicationPostingUrl = (value: string) => {
  const url = new URL(value)
  url.hash = ''
  for (const name of [...url.searchParams.keys()]) {
    if (
      name.toLowerCase().startsWith('utm_') ||
      ['fbclid', 'gclid'].includes(name.toLowerCase())
    ) {
      url.searchParams.delete(name)
    }
  }
  url.searchParams.sort()
  return url.toString().replace(/[?#]$/u, '')
}
