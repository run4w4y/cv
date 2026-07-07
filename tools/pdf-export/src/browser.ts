import { Context, Effect, Layer } from 'effect'
import { type Browser, chromium, type Page } from 'playwright'
import { PdfProcessError } from './errors'

export const PdfBrowser = Context.Service<Browser>('@cv/pdf-export/PdfBrowser')

export const PdfPage = Context.Service<Page>('@cv/pdf-export/PdfPage')

const launchBrowser = Effect.tryPromise({
  try: () =>
    chromium.launch({
      executablePath: process.env.CV_CHROME_PATH || process.env.CHROME_PATH,
    }),
  catch: (cause) =>
    new PdfProcessError({
      cause,
      command: 'chromium.launch',
      message: 'Could not launch Chromium',
    }),
})

const closeBrowser = (browser: Browser) =>
  Effect.tryPromise({
    try: () => browser.close(),
    catch: (cause) =>
      new PdfProcessError({
        cause,
        command: 'browser.close',
        message: 'Could not close Chromium',
      }),
  }).pipe(Effect.catch(() => Effect.succeed(undefined)))

const newPage = PdfBrowser.pipe(
  Effect.flatMap((browser) =>
    Effect.tryPromise({
      try: () => browser.newPage(),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'browser.newPage',
          message: 'Could not create Chromium page',
        }),
    })
  )
)

export const waitForLoadedImage = (
  page: Page,
  selector: string,
  message: string
) =>
  Effect.tryPromise({
    try: () =>
      page.waitForFunction(
        (imageSelector) => {
          const image = document.querySelector(imageSelector)

          return (
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0 &&
            image.naturalHeight > 0
          )
        },
        selector,
        { timeout: 10_000 }
      ),
    catch: (cause) =>
      new PdfProcessError({
        cause,
        command: 'page.waitForFunction',
        message,
      }),
  })

const closePage = (page: Page) =>
  Effect.tryPromise({
    try: () => page.close(),
    catch: (cause) =>
      new PdfProcessError({
        cause,
        command: 'page.close',
        message: 'Could not close Chromium page',
      }),
  }).pipe(Effect.catch(() => Effect.succeed(undefined)))

export const PdfBrowserLayer = Layer.effect(
  PdfBrowser,
  Effect.acquireRelease(launchBrowser, closeBrowser)
)

export const PdfPageLayer = Layer.effect(
  PdfPage,
  Effect.acquireRelease(newPage, closePage)
)
