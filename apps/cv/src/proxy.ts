import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  contentSecurityPolicy,
  cvPreviewFrameAncestors,
} from '@/server/content-security-policy'

const previewPathPattern = /(?:^|\/)_preview(?:\/|$)/u

export const proxy = (request: NextRequest) => {
  const nonce = btoa(crypto.randomUUID())
  const development = process.env.NODE_ENV === 'development'
  const webPreview = previewPathPattern.test(request.nextUrl.pathname)
  const policy = contentSecurityPolicy({
    development,
    ...(webPreview
      ? {
          frameAncestors: cvPreviewFrameAncestors({
            development,
            registryOrigin: process.env.CV_REGISTRY_ORIGIN,
          }),
        }
      : {}),
    nonce,
  })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', policy)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
