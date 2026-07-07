import { defaultLocale, type Locale } from './locale'
import { assertSafeString, tokenPattern } from './privacy'
import type { AnalyticsPathKind, AnalyticsPathRecord } from './types'

const parseAnalyticsUrl = (rawPath: string) => {
  const withoutToken = rawPath.replace(tokenPattern, '')

  try {
    return new URL(withoutToken.trim() || '/', 'https://cv.local')
  } catch {
    return null
  }
}

const safeIdentifier = (value: string | null | undefined) => {
  const identifier = value?.trim().replace(/[^\w.:-]/gu, '')

  if (!identifier) {
    return undefined
  }

  assertSafeString(identifier, 'query identifier')

  return identifier
}

export const normalizeAnalyticsPath = (rawPath: string) => {
  const parsed = parseAnalyticsUrl(rawPath)
  let path = parsed?.pathname ?? rawPath.replace(tokenPattern, '').trim()

  if (!parsed) {
    path = path.split(/[?#]/u)[0] ?? '/'
  }

  path = decodeURIComponent(path || '/')
    .replace(/\/{2,}/gu, '/')
    .replace(/[^\w./:-]/gu, '')

  if (!path.startsWith('/')) {
    path = `/${path}`
  }

  if (path !== '/' && !path.includes('.') && !path.endsWith('/')) {
    path = `${path}/`
  }

  assertSafeString(path, 'path')

  return path
}

export const classifyAnalyticsPath = (path: string) => {
  const normalizedPath = normalizeAnalyticsPath(path)
  const audienceMatch = normalizedPath.match(
    /^\/(?<locale>[^/.?#]+)\/a\/(?<audience>[^/.?#]+)\/$/u
  )

  if (audienceMatch?.groups) {
    const audienceId = safeIdentifier(audienceMatch.groups.audience)
    const locale = audienceMatch.groups.locale

    if (!audienceId) {
      return {
        kind: 'other',
        path: normalizedPath,
      } satisfies Pick<AnalyticsPathRecord, 'kind' | 'path'>
    }

    return {
      audienceId,
      kind: 'audience',
      locale,
      path: normalizedPath,
    } satisfies Pick<
      AnalyticsPathRecord,
      'audienceId' | 'kind' | 'locale' | 'path'
    >
  }

  const localeMatch = normalizedPath.match(/^\/(?<locale>[^/.?#]+)\/$/u)

  if (localeMatch?.groups) {
    const locale = localeMatch.groups.locale

    return {
      kind: 'public',
      locale,
      path: normalizedPath,
    } satisfies Pick<AnalyticsPathRecord, 'kind' | 'locale' | 'path'>
  }

  return {
    kind: 'other',
    path: normalizedPath,
  } satisfies Pick<AnalyticsPathRecord, 'kind' | 'path'>
}

export const localeFromAnalyticsPath = (path: string): Locale => {
  const classification = classifyAnalyticsPath(path)

  return classification.locale ?? defaultLocale
}

export const pathKindOrder = (kind: AnalyticsPathKind) =>
  kind === 'audience' ? 0 : kind === 'public' ? 1 : 2
