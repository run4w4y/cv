import { join } from 'node:path'
import { Effect, Option } from 'effect'
import { Command, Flag as Options } from 'effect/unstable/cli'
import {
  PdfBrowserLayer,
  PdfPage,
  PdfPageLayer,
  waitForLoadedImage,
} from './browser'
import { PdfProcessError } from './errors'
import { ensureDirectory } from './files'
import { publicPdfOutDir } from './paths'
import { startPreview, stopPreview, waitForServer } from './preview'
import { printOptions } from './print-options'
import { reportError, runCli } from './runtime'

const locale = Options.string('locale').pipe(
  Options.withDescription(
    'Public CV locale to render. Defaults to all published public locales.'
  ),
  Options.optional
)

const publishedPublicLocales = ['en', 'ru'] as const

const renderLocalePdf = (baseUrl: string, locale: string) =>
  Effect.gen(function* () {
    const page = yield* PdfPage

    const route = `/${locale}/`

    yield* Effect.tryPromise({
      try: () => page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.goto',
          message: `Could not open public CV page for ${locale}`,
        }),
    })

    yield* Effect.tryPromise({
      try: () =>
        page.waitForSelector('[data-print-qr-image][data-print-qr-ready]', {
          state: 'attached',
          timeout: 10_000,
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.waitForSelector',
          message: `Public CV QR image was not ready for ${locale}`,
        }),
    })

    yield* waitForLoadedImage(
      page,
      '[data-print-qr-image][data-print-qr-ready]',
      `Public CV QR image did not decode for ${locale}`
    )

    yield* Effect.tryPromise({
      try: () =>
        page.pdf({
          ...printOptions,
          path: join(publicPdfOutDir, `cv-${locale}.pdf`),
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.pdf',
          message: `Could not render public PDF for ${locale}`,
        }),
    })
  })

const renderAndReportLocalePdf = (baseUrl: string, locale: string) =>
  waitForServer(baseUrl, `/${locale}/`).pipe(
    Effect.andThen(
      renderLocalePdf(baseUrl, locale).pipe(
        Effect.provide(PdfPageLayer),
        Effect.provide(PdfBrowserLayer)
      )
    ),
    Effect.andThen(
      Effect.sync(() => {
        console.log(
          `Public PDF written to ${join(publicPdfOutDir, `cv-${locale}.pdf`)}`
        )
      })
    )
  )

const exportPublicPdfs = (locales: readonly string[]) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      startPreview(),
      ({ baseUrl }) =>
        ensureDirectory(publicPdfOutDir).pipe(
          Effect.andThen(
            Effect.forEach(locales, (locale) =>
              renderAndReportLocalePdf(baseUrl, locale)
            )
          )
        ),
      ({ preview }) => stopPreview(preview)
    )
  )

runCli(
  Command.make('public', { locale }, ({ locale }) =>
    exportPublicPdfs(
      Option.match(locale, {
        onNone: () => publishedPublicLocales,
        onSome: (locale) => [locale],
      })
    ).pipe(Effect.catch(reportError))
  ),
  {
    version: '0.1.0',
  }
)
