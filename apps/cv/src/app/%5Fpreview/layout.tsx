import type { ReactNode } from 'react'

import '../global.css'

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
