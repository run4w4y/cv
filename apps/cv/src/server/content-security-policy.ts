export interface ContentSecurityPolicyOptions {
  readonly development: boolean
  readonly frameAncestors?: ReadonlyArray<string>
  readonly nonce: string
}

export const defaultRegistryWebOrigin = 'https://cv-registry.4w4y.run'

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost'])

export const normalizeRegistryWebOrigin = (
  raw: string,
  development: boolean
): string => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('CV_REGISTRY_ORIGIN must be an absolute URL origin.')
  }

  const secure =
    url.protocol === 'https:' ||
    (development && url.protocol === 'http:' && loopbackHosts.has(url.hostname))
  if (!secure) {
    throw new Error(
      'CV_REGISTRY_ORIGIN must use HTTPS; development permits loopback HTTP.'
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
      'CV_REGISTRY_ORIGIN must contain only its scheme, host, and optional port.'
    )
  }
  return url.origin
}

export const cvPreviewFrameAncestors = ({
  development,
  registryOrigin = defaultRegistryWebOrigin,
}: {
  readonly development: boolean
  readonly registryOrigin?: string
}): ReadonlyArray<string> => [
  normalizeRegistryWebOrigin(registryOrigin, development),
  'cv-registry://app',
  ...(development ? ['http://localhost:4300', 'http://127.0.0.1:4300'] : []),
]

export const contentSecurityPolicy = ({
  development,
  frameAncestors = [],
  nonce,
}: ContentSecurityPolicyOptions) =>
  [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      development ? " 'unsafe-eval'" : ''
    }`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    `connect-src ${development ? "'self' ws: wss:" : "'none'"}`,
    'img-src data:',
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${
      frameAncestors.length === 0 ? "'none'" : frameAncestors.join(' ')
    }`,
  ].join('; ')
