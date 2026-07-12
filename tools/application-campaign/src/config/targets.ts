import {
  type WebBaseUrl,
  webBaseUrlFromSelfSchema,
  webBaseUrlSchema,
} from '@cv/content-core'
import { DateTime, Effect, Schema } from 'effect'
import { Path } from 'effect/Path'
import { uniq } from 'es-toolkit'
import { ApplicationCampaignConfigError } from '../errors'
import { rootDirectory } from '../paths'
import { slugify } from '../text'
import type { PrepareCampaignTarget } from './model'

export const parseCommaList = (value: string) =>
  uniq(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )

const parseUrlList = (value: string) =>
  value
    .split(/[\n\r,]+/u)
    .map((item) => item.trim())
    .filter(Boolean)

const configError = (message: string, cause?: unknown) =>
  new ApplicationCampaignConfigError({ cause, message })

const decodeUrl = Schema.decodeUnknownEffect(Schema.URLFromString, {
  errors: 'all',
})

const parseUrls = (values: readonly string[]) =>
  Effect.forEach(values, (value) =>
    decodeUrl(value).pipe(
      Effect.mapError((cause) =>
        configError(`Invalid job URL: ${value}`, cause)
      )
    )
  )

export const resolveUrls = ({
  envUrls,
  urlFileContents,
  urls = [],
}: {
  readonly envUrls?: string
  readonly urlFileContents?: string
  readonly urls?: readonly URL[]
}) =>
  Effect.gen(function* () {
    const parsedUrls = yield* parseUrls([
      ...parseUrlList(urlFileContents ?? ''),
      ...parseUrlList(envUrls ?? ''),
    ])
    const uniqueUrls = [
      ...new Map(
        [...urls, ...parsedUrls].map((url) => [url.href, url] as const)
      ).values(),
    ]

    if (uniqueUrls.length === 0) {
      return yield* Effect.fail(
        configError(
          'Missing job URL. Pass --url, --url-file, or APPLICATION_CAMPAIGN_URLS.'
        )
      )
    }

    return uniqueUrls
  })

export const resolveExcludedProfiles = ({
  envProfiles,
  profiles,
}: {
  readonly envProfiles?: string
  readonly profiles?: readonly string[]
}) =>
  profiles ??
  (envProfiles === undefined ? undefined : parseCommaList(envProfiles))

export const resolveProjectPath = (rawPath: string) =>
  Effect.gen(function* () {
    const path = yield* Path

    return path.isAbsolute(rawPath)
      ? path.normalize(rawPath)
      : path.resolve(rootDirectory, rawPath)
  })

const defaultOutDir = ({ outRoot, url }: { outRoot: string; url: URL }) =>
  Effect.gen(function* () {
    const path = yield* Path
    const date = DateTime.formatIsoDateUtc(yield* DateTime.now)
    const slug = slugify(
      `${url.hostname}-${url.pathname.split('/').filter(Boolean).at(-1) ?? 'job'}`
    )
    const resolvedOutRoot = yield* resolveProjectPath(outRoot)

    return path.join(resolvedOutRoot, `${date}-${slug}`)
  })

const uniquePaths = (paths: readonly string[]) => {
  const seen = new Map<string, number>()

  return paths.map((item) => {
    const count = seen.get(item) ?? 0
    seen.set(item, count + 1)

    return count === 0 ? item : `${item}-${count + 1}`
  })
}

export const resolveCampaignTargets = ({
  outDir,
  outRoot,
  urls,
}: {
  readonly outDir?: string
  readonly outRoot: string
  readonly urls: readonly URL[]
}) =>
  Effect.gen(function* () {
    const resolvedOutDir = outDir
      ? yield* resolveProjectPath(outDir)
      : undefined

    if (resolvedOutDir && urls.length === 1) {
      return {
        runOutDir: resolvedOutDir,
        targets: [
          {
            index: 0,
            outDir: resolvedOutDir,
            url: urls[0] as URL,
          } satisfies PrepareCampaignTarget,
        ],
      }
    }

    const resolvedOutRoot =
      resolvedOutDir ?? (yield* resolveProjectPath(outRoot))
    const targetOutDirs = uniquePaths(
      yield* Effect.forEach(urls, (url) =>
        defaultOutDir({ outRoot: resolvedOutRoot, url })
      )
    )

    return {
      runOutDir:
        urls.length === 1
          ? (targetOutDirs[0] ?? resolvedOutRoot)
          : resolvedOutRoot,
      targets: urls.map((url, index) => ({
        index,
        outDir: targetOutDirs[index] ?? resolvedOutRoot,
        url,
      })),
    }
  })

const urlFromHost = (host: string) =>
  Schema.decodeUnknownEffect(webBaseUrlSchema)(`https://${host}`).pipe(
    Effect.mapError((cause) =>
      configError(`Invalid CV web host: ${host}`, cause)
    )
  )

export const resolveWebBaseUrl = ({
  baseUrl,
  cvWebBaseUrl,
  cvWebHost,
  envBaseUrl,
  publicCvWebBaseUrl,
}: {
  readonly baseUrl?: WebBaseUrl
  readonly cvWebBaseUrl?: WebBaseUrl
  readonly cvWebHost?: string
  readonly envBaseUrl?: WebBaseUrl
  readonly publicCvWebBaseUrl?: WebBaseUrl
}) => {
  const resolved = baseUrl ?? envBaseUrl ?? cvWebBaseUrl ?? publicCvWebBaseUrl

  return resolved
    ? Schema.decodeUnknownEffect(webBaseUrlFromSelfSchema)(resolved).pipe(
        Effect.mapError((cause) =>
          configError('Invalid deployed CV base URL.', cause)
        )
      )
    : cvWebHost
      ? urlFromHost(cvWebHost)
      : Effect.succeed(undefined)
}
