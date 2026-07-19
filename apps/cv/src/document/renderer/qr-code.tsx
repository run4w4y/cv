import { renderSVG } from 'uqr'

export interface CvPublicUrlQrProps {
  readonly publicUrl: string
  readonly title: string
}

const qrDataUrl = (value: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    renderSVG(value, { border: 4, ecc: 'M', pixelSize: 1 })
  )}`

/** A deterministic, hydration-free QR image for the exact supplied URL. */
export const CvPublicUrlQr = ({ publicUrl, title }: CvPublicUrlQrProps) => (
  // biome-ignore lint/performance/noImgElement: The QR is an inline print asset, not an optimizable remote image.
  <img
    alt={title}
    className="cv2-qr"
    data-cv-public-url={publicUrl}
    src={qrDataUrl(publicUrl)}
  />
)
