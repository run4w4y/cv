import { cvPreviewUrl } from '@cv/application-registry-api-contract'
import type { CvLink } from '@cv/application-registry-entity'

export const CvDocumentPreview = ({ link }: { readonly link: CvLink }) => {
  return (
    <iframe
      className="min-h-176 w-full rounded-md border border-border bg-white"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts"
      src={cvPreviewUrl(link)}
      title="Private CV preview"
    />
  )
}
