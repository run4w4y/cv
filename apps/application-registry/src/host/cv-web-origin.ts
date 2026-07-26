export const defaultCvWebOrigin = 'https://cv.4w4y.run'

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost'])

export const normalizeCvWebOrigin = (
  raw: string,
  development: boolean
): string => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('VITE_CV_WEB_ORIGIN must be an absolute URL origin.')
  }

  const secure =
    url.protocol === 'https:' ||
    (development && url.protocol === 'http:' && loopbackHosts.has(url.hostname))
  if (!secure) {
    throw new Error(
      'VITE_CV_WEB_ORIGIN must use HTTPS; development permits loopback HTTP.'
    )
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(
      'VITE_CV_WEB_ORIGIN must contain only its scheme, host, and optional port.'
    )
  }
  return url.origin
}

export const registryContentSecurityPolicy = (cvWebOrigin: string): string =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' http: https:",
    "object-src 'none'",
    "base-uri 'none'",
    `frame-src blob: ${cvWebOrigin}`,
    "form-action 'self'",
  ].join('; ')
