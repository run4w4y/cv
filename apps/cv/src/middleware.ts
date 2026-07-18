import { defineMiddleware } from 'astro:middleware'

import { matchPublicCvRoute } from './lib/public-route'

const secure = (response: Response): Response => {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; img-src data:; style-src 'unsafe-inline'"
  )
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!matchPublicCvRoute(context.url.pathname)) {
    return secure(
      new Response('Not found', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 404,
      })
    )
  }

  return secure(await next())
})
