import type { ReactNode } from 'react'

import { CvHtmlDocument } from '@/app/cv-html-document'
import '../global.css'
import '@/document/renderer/styles.css'

export default function PreviewLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  return <CvHtmlDocument>{children}</CvHtmlDocument>
}
