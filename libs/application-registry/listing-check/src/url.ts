/** Parse with the host's standards-compliant URL implementation. */
export const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}
