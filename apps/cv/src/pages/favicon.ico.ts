import { neutralFaviconSvg } from '@/lib/site-assets'

export const GET = async () => {
  return new Response(neutralFaviconSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
    },
  })
}
