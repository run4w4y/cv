import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

initOpenNextCloudflareForDev()

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
  basePath: '/c',
  poweredByHeader: false,
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:token((?!_preview$|_internal$)[^/]+)',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; img-src data:; style-src 'self' 'unsafe-inline'",
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
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-ancestors *; img-src data:; style-src 'self' 'unsafe-inline'",
          },
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
