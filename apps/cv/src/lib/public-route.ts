export const publicCvRoutePattern = /^\/c\/([^/]+)$/u

export const matchPublicCvRoute = (pathname: string): string | null => {
  const match = publicCvRoutePattern.exec(pathname)
  if (!match?.[1]) return null

  try {
    const token = decodeURIComponent(match[1])
    return token.length > 0 && !token.includes('/') ? token : null
  } catch {
    return null
  }
}
