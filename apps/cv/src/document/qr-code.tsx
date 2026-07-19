import QRCodeCore from 'qrcode/lib/core/qrcode.js'

type QrSymbol = {
  readonly path: string
  readonly size: number
}

const quietZoneModules = 4

const createQrSymbol = (value: string): QrSymbol => {
  const qrCode = QRCodeCore.create(value, { errorCorrectionLevel: 'M' })
  const commands: Array<string> = []

  for (let row = 0; row < qrCode.modules.size; row += 1) {
    for (let column = 0; column < qrCode.modules.size; column += 1) {
      if (qrCode.modules.get(row, column) === 1) {
        commands.push(`M${column} ${row}h1v1h-1z`)
      }
    }
  }

  return {
    path: commands.join(''),
    size: qrCode.modules.size,
  }
}

export interface CvPublicUrlQrProps {
  readonly publicUrl: string
  readonly title: string
  readonly titleId: string
}

/** A deterministic, hydration-free SVG QR code for the exact supplied URL. */
export const CvPublicUrlQr = ({
  publicUrl,
  title,
  titleId,
}: CvPublicUrlQrProps) => {
  const symbol = createQrSymbol(publicUrl)
  const viewBoxSize = symbol.size + quietZoneModules * 2

  return (
    <svg
      aria-labelledby={titleId}
      className="cv2-qr"
      data-cv-public-url={publicUrl}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>{title}</title>
      <rect fill="#fff" height={viewBoxSize} width={viewBoxSize} />
      <path
        d={symbol.path}
        fill="currentColor"
        transform={`translate(${quietZoneModules} ${quietZoneModules})`}
      />
    </svg>
  )
}
