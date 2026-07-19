import type { CvLink } from '@cv/application-registry-entity'

export const cvPreviewUrl = (
  link: Pick<CvLink, 'previewToken' | 'publicUrl' | 'token'>
): string => {
  const url = new URL(link.publicUrl)
  const encodedToken = encodeURIComponent(link.token)
  if (!url.pathname.endsWith(encodedToken)) {
    throw new Error('The CV page URL does not end with its token.')
  }
  url.pathname = `${url.pathname.slice(0, -encodedToken.length)}_preview/${encodedToken}`
  url.searchParams.set('access', link.previewToken)
  return url.toString()
}
