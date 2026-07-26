import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// The unpublished Effect State Tree workspace lives beside this repository
// during development. Turbopack must be rooted at their common parent so it
// can follow Bun's workspace links until those packages are published.
const localWorkspaceRoot = fileURLToPath(new URL('../../..', import.meta.url))

const securityHeaders = [
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()',
  },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
] as const

const nextConfig: NextConfig = {
  devIndicators: false,
  basePath: '/c',
  output: 'standalone',
  outputFileTracingRoot: localWorkspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:token((?!_preview$|_render$|_internal$)[^/]+)',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          {
            key: 'Cloudflare-CDN-Cache-Control',
            value:
              'public, max-age=86400, stale-while-revalidate=604800, stale-if-error=2592000',
          },
        ],
      },
      {
        source: '/_preview/:path*',
        headers: [
          ...securityHeaders.filter(
            ({ key }) =>
              key !== 'X-Frame-Options' &&
              key !== 'Cross-Origin-Resource-Policy'
          ),
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/_render/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/_internal/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ]
  },
}

export default nextConfig
