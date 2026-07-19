import type { ReactNode } from 'react'

import '../global.css'
import '@/document/renderer/styles.css'

export default function PreviewLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
