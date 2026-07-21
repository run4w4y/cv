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
  devIndicators: false,
  basePath: '/c',
  poweredByHeader: false,
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:token((?!_preview$|_internal$)[^/]+)',
        headers: [...securityHeaders],
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
