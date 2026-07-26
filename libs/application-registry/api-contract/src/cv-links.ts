import type { CvLink } from '@cv/application-registry-entity'

export type CvCapabilityLink = Pick<
  CvLink,
  'previewToken' | 'publicUrl' | 'token'
>

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost'])

const capabilityUrl = (
  route: '_preview' | '_render',
  link: Pick<CvLink, 'previewToken' | 'publicUrl' | 'token'>
): string => {
  let url: URL
  try {
    url = new URL(link.publicUrl)
  } catch {
    throw new Error('The CV page URL must be an absolute URL.')
  }

  const secure =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && loopbackHosts.has(url.hostname))
  if (!secure) {
    throw new Error(
      'The CV page URL must use HTTPS, except for loopback development URLs.'
    )
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('The CV page URL must not contain credentials.')
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error('The CV page URL must not contain a query or fragment.')
  }

  const separator = url.pathname.lastIndexOf('/')
  const finalSegment = url.pathname.slice(separator + 1)
  let decodedSegment: string
  try {
    decodedSegment = decodeURIComponent(finalSegment)
  } catch {
    throw new Error('The CV page URL contains an invalid token segment.')
  }
  if (decodedSegment !== link.token) {
    throw new Error('The CV page URL does not end with its token.')
  }

  url.pathname = `${url.pathname.slice(0, separator + 1)}${route}/${encodeURIComponent(link.token)}`
  url.searchParams.set('access', link.previewToken)
  return url.toString()
}

/** Capability-protected web CV rendered exactly like its public page. */
export const cvWebPreviewUrl = (link: CvCapabilityLink): string =>
  capabilityUrl('_preview', link)

/** Capability-protected deterministic A4 surface used only by the PDF worker. */
export const cvPdfRenderUrl = (link: CvCapabilityLink): string =>
  capabilityUrl('_render', link)
