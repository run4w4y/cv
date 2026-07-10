import { Effect } from 'effect'
import { PdfPage, waitForLoadedImage } from './browser'
import { PdfProcessError } from './errors'
import { printOptions } from './print-options'

export type RenderPdfRequest = {
  readonly label: string
  readonly localBaseUrl: string
  readonly outputPath: string
  readonly previewPath: string
  readonly printUrl?: string
  readonly readySelector: string
}

const applyPrintUrl = (printUrl: string) => {
  document
    .querySelectorAll<HTMLAnchorElement>('[data-print-qr-link]')
    .forEach((link) => {
      link.href = printUrl
    })
  document
    .querySelectorAll<HTMLImageElement>('[data-print-qr-image]')
    .forEach((image) => {
      image.setAttribute('data-print-qr-url', printUrl)
      image.removeAttribute('data-print-qr-ready')
      image.removeAttribute('data-private-qr-ready')
      image.removeAttribute('data-print-qr-rendered-url')
    })
}

export const renderPdf = ({
  label,
  localBaseUrl,
  outputPath,
  previewPath,
  printUrl,
  readySelector,
}: RenderPdfRequest) =>
  Effect.gen(function* () {
    const page = yield* PdfPage

    yield* Effect.tryPromise({
      try: () =>
        page.goto(`${localBaseUrl}${previewPath}`, {
          waitUntil: 'networkidle',
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.goto',
          message: `Could not open ${label}`,
        }),
    })

    yield* Effect.tryPromise({
      try: () =>
        page.waitForSelector(readySelector, {
          state: 'attached',
          timeout: 10_000,
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.waitForSelector',
          message: `${label} QR image was not ready`,
        }),
    })

    if (printUrl) {
      yield* Effect.tryPromise({
        try: () => page.evaluate(applyPrintUrl, printUrl),
        catch: (cause) =>
          new PdfProcessError({
            cause,
            command: 'page.evaluate',
            message: `Could not apply print URL for ${label}`,
          }),
      })

      yield* Effect.tryPromise({
        try: () =>
          page.waitForSelector(readySelector, {
            state: 'attached',
            timeout: 10_000,
          }),
        catch: (cause) =>
          new PdfProcessError({
            cause,
            command: 'page.waitForSelector',
            message: `${label} QR image was not ready after its URL changed`,
          }),
      })
    }

    yield* waitForLoadedImage(
      page,
      readySelector,
      `${label} QR image did not decode`
    )

    yield* Effect.tryPromise({
      try: () =>
        page.pdf({
          ...printOptions,
          path: outputPath,
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.pdf',
          message: `Could not render ${label} PDF`,
        }),
    })
  })
