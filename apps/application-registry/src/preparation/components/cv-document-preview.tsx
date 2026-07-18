import type { CvDocumentV1 } from '@cv/contracts/document'
import {
  assessCvPageLayout,
  CvDocumentRenderer,
  type CvPageLayoutAssessment,
  cvPageLayoutToleranceCssPixels,
  measureCvPageLayoutInDocument,
} from '@cv/renderer'
import * as React from 'react'
import { createPortal } from 'react-dom'

const previewShell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;min-height:100%;background:#f1f5f9}body{padding:16px;box-sizing:border-box}</style>
  </head>
  <body></body>
</html>`

export const CvDocumentPreview = ({
  document,
  onPageLayoutChange,
  publicUrl,
}: {
  readonly document: CvDocumentV1
  readonly onPageLayoutChange?: (
    assessment: CvPageLayoutAssessment | null
  ) => void
  readonly publicUrl?: string
}) => {
  const [mount, setMount] = React.useState<HTMLElement | null>(null)
  const [pageLayout, setPageLayout] =
    React.useState<CvPageLayoutAssessment | null>(null)
  const frameRef = React.useRef<HTMLIFrameElement>(null)

  const connect = React.useCallback(() => {
    setMount(frameRef.current?.contentDocument?.body ?? null)
  }, [])

  React.useEffect(() => {
    // The values are renderer inputs: reading them here makes this measurement
    // lifecycle follow the portal commit whenever either input changes.
    void document
    void publicUrl
    setPageLayout(null)
    onPageLayoutChange?.(null)
    if (mount === null) return

    const frameWindow = mount.ownerDocument.defaultView
    if (frameWindow === null) return

    let observer: ResizeObserver | null = null
    let requestId = 0
    let active = true
    const measure = () => {
      if (!active) return
      const assessment = assessCvPageLayout(
        measureCvPageLayoutInDocument(mount.ownerDocument)
      )
      setPageLayout(assessment)
      onPageLayoutChange?.(assessment)
    }
    const afterLayout = () => {
      if (!active) return
      requestId = frameWindow.requestAnimationFrame(() => {
        if (!active) return
        requestId = frameWindow.requestAnimationFrame(() => {
          if (!active) return
          const cvDocument =
            mount.querySelector<HTMLElement>('[data-cv-document]')
          if (cvDocument === null) return
          observer = new frameWindow.ResizeObserver(measure)
          observer.observe(cvDocument)
          measure()
        })
      })
    }

    void mount.ownerDocument.fonts.ready.then(afterLayout)

    return () => {
      active = false
      observer?.disconnect()
      frameWindow.cancelAnimationFrame(requestId)
    }
  }, [document, mount, onPageLayoutChange, publicUrl])

  const pageWarning =
    pageLayout?.status === 'overflow'
      ? `The final layout exceeds one A4 page${
          pageLayout.overflowHeightPx > cvPageLayoutToleranceCssPixels
            ? ` by ${pageLayout.overflowHeightPx.toFixed(1)} CSS px vertically`
            : ''
        }${
          pageLayout.overflowWidthPx > cvPageLayoutToleranceCssPixels
            ? ` by ${pageLayout.overflowWidthPx.toFixed(1)} CSS px horizontally`
            : ''
        }. Shorten the content before publishing.`
      : pageLayout?.status === 'invalid'
        ? 'The one-page layout could not be measured. PDF publication will remain blocked until it can be validated.'
        : null

  return (
    <>
      <iframe
        className="min-h-176 w-full rounded-md border border-border bg-white"
        onLoad={connect}
        ref={frameRef}
        sandbox="allow-same-origin"
        srcDoc={previewShell}
        title="Live CV document preview"
      />
      {mount
        ? createPortal(
            <CvDocumentRenderer
              document={document}
              mode="print-preview"
              publicUrl={publicUrl}
            />,
            mount
          )
        : null}
      {pageWarning ? (
        <p
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {pageWarning}
        </p>
      ) : null}
    </>
  )
}
