import { join } from 'node:path'
import { decodeWebBaseUrlFromSelf, resolveWebBaseUrl } from '@cv/content-core'
import { Context, Effect, Layer } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import {
  ChildProcessSpawner,
  type ChildProcessSpawner as ChildProcessSpawnerService,
} from 'effect/unstable/process/ChildProcessSpawner'
import { makePdfBrowserLayer, PdfPageLayer } from './browser'
import { runCommand } from './commands'
import { type PdfExportError, PdfUsageError } from './errors'
import { ensureDirectory } from './files'
import type {
  PdfExportSessionOptions,
  ProfilePdfBatchExportRequest,
  ProfilePdfExportRequest,
  ProfilePdfExportResult,
  PublicPdfExportRequest,
  PublicPdfExportResult,
} from './model'
import { cvAppRoot, privatePdfOutDir, publicPdfOutDir, root } from './paths'
import { startPreview, stopPreview, waitForServer } from './preview'
import { renderPdf } from './render'

const cvWebBaseUrlEnv = 'CV_WEB_BASE_URL'
const privateReadySelector = '[data-private-qr-image][data-private-qr-ready]'
const publicReadySelector = '[data-print-qr-image][data-print-qr-ready]'

const sanitizeFileSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)

const profilePdfFileName = ({
  audienceId,
  locale,
  outputFileName,
}: {
  readonly audienceId: string
  readonly locale: string
  readonly outputFileName?: string
}) => outputFileName ?? `cv-${locale}-${sanitizeFileSegment(audienceId)}.pdf`

export const privatePreviewPath = ({
  audienceId,
  locale,
  token,
}: {
  readonly audienceId: string
  readonly locale: string
  readonly token: string
}) => {
  const params = new URLSearchParams({ audience: audienceId, p: token })

  return `/${locale}/a/#${params.toString()}`
}

export const publicPreviewPath = (locale: string) => `/${locale}/`

const deployedUrl = (baseUrl: URL, path: string) =>
  resolveWebBaseUrl(decodeWebBaseUrlFromSelf(baseUrl), path)

export const privatePrintUrl = ({
  audienceId,
  locale,
  token,
  webBaseUrl,
}: {
  readonly audienceId: string
  readonly locale: string
  readonly token: string
  readonly webBaseUrl?: URL
}) => {
  if (!webBaseUrl) {
    return undefined
  }

  const url = deployedUrl(
    webBaseUrl,
    `/${locale}/a/${encodeURIComponent(audienceId)}/`
  )

  url.searchParams.set('p', token)

  return url.href
}

export const publicPrintUrl = (locale: string, webBaseUrl?: URL) =>
  webBaseUrl ? deployedUrl(webBaseUrl, `/${locale}/`).href : undefined

const sessionDefaults = (options: PdfExportSessionOptions) => ({
  appRoot: options.appRoot ?? cvAppRoot,
  chromeExecutablePath:
    options.chromeExecutablePath ??
    process.env.CV_CHROME_PATH ??
    process.env.CHROME_PATH,
  env: options.env ?? process.env,
  output: options.output ?? 'inherit',
  preferredPort: options.preferredPort ?? 4322,
  rootDir: options.rootDir ?? root,
  skipBuild: options.skipBuild ?? false,
  webBaseUrl: options.webBaseUrl,
})

const buildAssets = (options: ReturnType<typeof sessionDefaults>) =>
  options.skipBuild
    ? Effect.void
    : runCommand(
        join(options.rootDir, 'node_modules', '.bin', 'astro'),
        ['build'],
        {
          ...options.env,
          ...(options.webBaseUrl
            ? { [cvWebBaseUrlEnv]: options.webBaseUrl.href }
            : {}),
          ASTRO_TELEMETRY_DISABLED: '1',
        },
        options.appRoot,
        options.output
      )

const withPreview = <A, E, R>(
  options: ReturnType<typeof sessionDefaults>,
  use: (localBaseUrl: string) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      startPreview({
        appRoot: options.appRoot,
        env: options.env,
        output: options.output,
        preferredPort: options.preferredPort,
        rootDir: options.rootDir,
      }),
      ({ baseUrl }) => use(baseUrl),
      ({ preview }) => stopPreview(preview)
    )
  )

const renderProfilesLive = ({
  items,
  outputDir = privatePdfOutDir,
  ...rawOptions
}: ProfilePdfBatchExportRequest) => {
  const options = sessionDefaults(rawOptions)

  if (items.length === 0) {
    return Effect.fail(new PdfUsageError({ message: 'No profiles to export' }))
  }

  return buildAssets(options).pipe(
    Effect.andThen(ensureDirectory(outputDir)),
    Effect.andThen(
      withPreview(options, (localBaseUrl) =>
        Effect.forEach(
          items,
          (item) => {
            const readyPath = `/${item.locale}/a/`
            const previewPath = privatePreviewPath({
              ...item,
            })
            const outputPath = join(outputDir, profilePdfFileName(item))

            return waitForServer(localBaseUrl, readyPath).pipe(
              Effect.andThen(
                renderPdf({
                  label: `private profile ${item.locale}/${item.audienceId}`,
                  localBaseUrl,
                  outputPath,
                  previewPath,
                  printUrl: privatePrintUrl({
                    ...item,
                    webBaseUrl: options.webBaseUrl,
                  }),
                  readySelector: privateReadySelector,
                }).pipe(Effect.provide(PdfPageLayer))
              ),
              Effect.as({
                audienceId: item.audienceId,
                locale: item.locale,
                outputPath,
                previewPath,
              } satisfies ProfilePdfExportResult)
            )
          },
          { concurrency: 1 }
        ).pipe(
          Effect.provide(makePdfBrowserLayer(options.chromeExecutablePath))
        )
      )
    )
  )
}

const renderPublicLive = ({
  locales,
  outputDir = publicPdfOutDir,
  ...rawOptions
}: PublicPdfExportRequest) => {
  const options = sessionDefaults(rawOptions)

  if (locales.length === 0) {
    return Effect.fail(new PdfUsageError({ message: 'No locales to export' }))
  }

  return buildAssets(options).pipe(
    Effect.andThen(ensureDirectory(outputDir)),
    Effect.andThen(
      withPreview(options, (localBaseUrl) =>
        Effect.forEach(
          locales,
          (locale) => {
            const readyPath = `/${locale}/`
            const previewPath = publicPreviewPath(locale)
            const outputPath = join(outputDir, `cv-${locale}.pdf`)

            return waitForServer(localBaseUrl, readyPath).pipe(
              Effect.andThen(
                renderPdf({
                  label: `public profile ${locale}`,
                  localBaseUrl,
                  outputPath,
                  previewPath,
                  printUrl: publicPrintUrl(locale, options.webBaseUrl),
                  readySelector: publicReadySelector,
                }).pipe(Effect.provide(PdfPageLayer))
              ),
              Effect.as({
                locale,
                outputPath,
                previewPath,
              } satisfies PublicPdfExportResult)
            )
          },
          { concurrency: 1 }
        ).pipe(
          Effect.provide(makePdfBrowserLayer(options.chromeExecutablePath))
        )
      )
    )
  )
}

export type PdfExporterService = {
  readonly exportProfile: (
    request: ProfilePdfExportRequest
  ) => Effect.Effect<ProfilePdfExportResult, PdfExportError>
  readonly exportProfiles: (
    request: ProfilePdfBatchExportRequest
  ) => Effect.Effect<readonly ProfilePdfExportResult[], PdfExportError>
  readonly exportPublic: (
    request: PublicPdfExportRequest
  ) => Effect.Effect<readonly PublicPdfExportResult[], PdfExportError>
}

export class PdfExporter extends Context.Service<
  PdfExporter,
  PdfExporterService
>()('@cv/pdf-export/PdfExporter') {}

type PdfExporterDependencies =
  | FileSystem
  | ChildProcessSpawnerService
  | HttpClient.HttpClient

export const PdfExporterLive = Layer.effect(
  PdfExporter,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const childProcessSpawner = yield* ChildProcessSpawner
    const httpClient = yield* HttpClient.HttpClient

    const provideDependencies = <A, E>(
      effect: Effect.Effect<A, E, PdfExporterDependencies>
    ) =>
      effect.pipe(
        Effect.provideService(FileSystem, fileSystem),
        Effect.provideService(ChildProcessSpawner, childProcessSpawner),
        Effect.provideService(HttpClient.HttpClient, httpClient)
      )

    const exportProfiles = (request: ProfilePdfBatchExportRequest) =>
      provideDependencies(renderProfilesLive(request))

    return {
      exportProfile: (request) =>
        exportProfiles({
          appRoot: request.appRoot,
          chromeExecutablePath: request.chromeExecutablePath,
          env: request.env,
          items: [request],
          output: request.output,
          outputDir: request.outputDir,
          preferredPort: request.preferredPort,
          rootDir: request.rootDir,
          skipBuild: request.skipBuild,
          webBaseUrl: request.webBaseUrl,
        }).pipe(
          Effect.flatMap((results) =>
            results[0]
              ? Effect.succeed(results[0])
              : Effect.fail(
                  new PdfUsageError({
                    message: 'Profile export returned no result',
                  })
                )
          )
        ),
      exportProfiles,
      exportPublic: (request) => provideDependencies(renderPublicLive(request)),
    } satisfies PdfExporterService
  })
)

export const exportProfilePdf = (request: ProfilePdfExportRequest) =>
  PdfExporter.pipe(Effect.flatMap((service) => service.exportProfile(request)))

export const exportProfilePdfs = (request: ProfilePdfBatchExportRequest) =>
  PdfExporter.pipe(Effect.flatMap((service) => service.exportProfiles(request)))

export const exportPublicPdfs = (request: PublicPdfExportRequest) =>
  PdfExporter.pipe(Effect.flatMap((service) => service.exportPublic(request)))
