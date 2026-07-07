import { join } from 'node:path'
import { Effect } from 'effect'
import { Command, Flag as Options } from 'effect/unstable/cli'
import {
  PdfBrowserLayer,
  PdfPage,
  PdfPageLayer,
  waitForLoadedImage,
} from './browser'
import { runCommand } from './commands'
import { PdfProcessError } from './errors'
import { ensureDirectory } from './files'
import { cvAppRoot, privatePdfOutDir, root } from './paths'
import { startPreview, stopPreview, waitForServer } from './preview'
import { printOptions } from './print-options'
import { reportError, runCli } from './runtime'

type ProfileExportContext = {
  audience: string
  locale: string
  skipBuild: boolean
  token: string
}

const audience = Options.string('audience').pipe(
  Options.withDescription(
    'Private audience id/path segment from the capability token.'
  )
)
const token = Options.string('token').pipe(
  Options.withDescription('Private profile capability token.')
)
const locale = Options.string('locale').pipe(
  Options.withDescription('Private profile locale.')
)
const skipBuild = Options.boolean('skip-build').pipe(
  Options.withDescription('Reuse an existing CV build instead of rebuilding.')
)

const sanitizeFileSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)

const renderProfilePdf = (
  baseUrl: string,
  previewPath: string,
  outputPath: string
) =>
  Effect.gen(function* () {
    const page = yield* PdfPage

    yield* Effect.tryPromise({
      try: () =>
        page.goto(`${baseUrl}${previewPath}`, { waitUntil: 'networkidle' }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.goto',
          message: 'Could not open private profile page',
        }),
    })

    yield* Effect.tryPromise({
      try: () =>
        page.waitForSelector('[data-private-qr-image][data-private-qr-ready]', {
          state: 'attached',
          timeout: 10_000,
        }),
      catch: (cause) =>
        new PdfProcessError({
          cause,
          command: 'page.waitForSelector',
          message: 'Private profile QR image was not ready',
        }),
    })

    yield* waitForLoadedImage(
      page,
      '[data-private-qr-image][data-private-qr-ready]',
      'Private profile QR image did not decode'
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
          message: 'Could not render private profile PDF',
        }),
    })
  })

const buildProfileAssets = (buildEnv: NodeJS.ProcessEnv) =>
  runCommand(
    join(root, 'node_modules', '.bin', 'astro'),
    ['build'],
    buildEnv,
    cvAppRoot
  )

const buildProfileAssetsIfNeeded = (
  skipBuild: boolean,
  buildEnv: NodeJS.ProcessEnv
) => (skipBuild ? Effect.succeed(undefined) : buildProfileAssets(buildEnv))

const exportProfilePdf = ({
  audience,
  locale,
  skipBuild,
  token,
}: ProfileExportContext) => {
  const buildEnv = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
  }
  const previewReadyPath = `/${locale}/a/`
  const localPreviewPath = `${previewReadyPath}#audience=${encodeURIComponent(audience)}&p=${encodeURIComponent(token)}`
  const outputPath = join(
    privatePdfOutDir,
    `cv-${locale}-${sanitizeFileSegment(audience)}.pdf`
  )

  return buildProfileAssetsIfNeeded(skipBuild, buildEnv).pipe(
    Effect.andThen(ensureDirectory(privatePdfOutDir)),
    Effect.andThen(
      Effect.scoped(
        Effect.acquireUseRelease(
          startPreview(),
          ({ baseUrl }) =>
            waitForServer(baseUrl, previewReadyPath).pipe(
              Effect.andThen(
                renderProfilePdf(baseUrl, localPreviewPath, outputPath).pipe(
                  Effect.provide(PdfPageLayer),
                  Effect.provide(PdfBrowserLayer)
                )
              ),
              Effect.andThen(
                Effect.sync(() => {
                  console.log(`Private profile PDF written to ${outputPath}`)
                })
              )
            ),
          ({ preview }) => stopPreview(preview)
        )
      )
    )
  )
}

runCli(
  Command.make('profile', { audience, locale, skipBuild, token }, (options) =>
    exportProfilePdf(options).pipe(Effect.catch(reportError))
  ),
  {
    version: '0.1.0',
  }
)
