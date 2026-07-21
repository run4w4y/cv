import {
  assertCvFitsSingleA4Page,
  CvPageLayoutError,
  type CvPageLayoutMeasurement,
  CvRenderPageHttpError,
  mapPdfRenderError,
  measureCvPageLayoutInDocument,
  PdfRenderer,
} from '@cv/application-registry-pdf-processing'
import { Effect, Layer } from 'effect'
import type { Browser } from 'playwright'

export const makePlaywrightPdfRendererLayer = (browser: Browser) =>
  Layer.succeed(
    PdfRenderer,
    PdfRenderer.of({
      render: Effect.fn('PlaywrightPdfRenderer.render')((renderUrl: string) =>
        Effect.tryPromise({
          try: async () => {
            const page = await browser.newPage()
            try {
              const response = await page.goto(renderUrl, {
                timeout: 45_000,
                waitUntil: 'networkidle',
              })
              if (!response?.ok()) {
                throw new CvRenderPageHttpError(response?.status() ?? 503)
              }

              await page.emulateMedia({ media: 'print' })
              await page.evaluate(async () => {
                await document.fonts.ready
                await new Promise<void>((resolve) => {
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve())
                  )
                })
              })
              assertCvFitsSingleA4Page(
                await page.evaluate(
                  measureCvPageLayoutInDocument as () => CvPageLayoutMeasurement
                )
              )

              const rendererVersion = await page
                .locator('[data-cv-pdf-document]')
                .first()
                .getAttribute('data-cv-render-version')
              if (!rendererVersion?.trim()) {
                throw new CvPageLayoutError(
                  'cv_page_layout_invalid',
                  'The CV render page did not identify its render version.'
                )
              }

              return {
                bytes: new Uint8Array(
                  await page.pdf({
                    format: 'A4',
                    preferCSSPageSize: true,
                    printBackground: true,
                  })
                ),
                rendererVersion: rendererVersion.trim(),
              }
            } finally {
              await page.close()
            }
          },
          catch: mapPdfRenderError,
        })
      ),
    })
  )
