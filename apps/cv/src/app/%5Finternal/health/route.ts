export const dynamic = 'force-dynamic'

export const GET = () =>
  Response.json(
    { service: 'cv-web', status: 'ok' },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
