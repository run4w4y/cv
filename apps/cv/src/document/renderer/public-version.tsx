import type { CvRendererLabels } from './labels'
import { CvPublicUrlQr } from './qr-code'

export const PublicVersion = ({
  labels,
  publicUrl,
}: {
  readonly labels: CvRendererLabels
  readonly publicUrl: string
}) => (
  <figure className="cv2-publication" data-cv-print-only>
    <a
      aria-label={labels.publicVersionInstructions}
      className="cv2-publication-link"
      href={publicUrl}
    >
      <CvPublicUrlQr
        publicUrl={publicUrl}
        title={labels.publicVersionInstructions}
      />
    </a>
    <figcaption>
      <strong className="cv2-publication-label">{labels.publicVersion}</strong>
      <span className="cv2-publication-instructions">
        {labels.publicVersionInstructions}
      </span>
      <a className="cv2-publication-url" href={publicUrl}>
        {publicUrl}
      </a>
    </figcaption>
  </figure>
)
