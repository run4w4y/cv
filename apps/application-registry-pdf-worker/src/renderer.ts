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
import { chromium } from 'playwright'

export const makePlaywrightPdfRendererLayer = (browserCdpUrl: URL) =>
  Layer.succeed(
    PdfRenderer,
    PdfRenderer.of({
      render: Effect.fn('PlaywrightPdfRenderer.render')((renderUrl: string) =>
        Effect.tryPromise({
          try: async () => {
            const browser = await chromium.connectOverCDP(browserCdpUrl.href, {
              timeout: 15_000,
            })
            try {
              const context = await browser.newContext()
              try {
                const page = await context.newPage()
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
                await context.close()
              }
            } finally {
              if (browser.isConnected()) await browser.close()
            }
          },
          catch: mapPdfRenderError,
        })
      ),
    })
  )
