declare module 'qrcode/lib/core/qrcode.js' {
  import type { QRCode, QRCodeOptions, QRCodeSegment } from 'qrcode'

  const core: {
    readonly create: (
      value: string | ReadonlyArray<QRCodeSegment>,
      options?: QRCodeOptions
    ) => QRCode
  }

  export default core
}
