import { DomUtils, ElementType, parseDocument } from 'htmlparser2'

export const normalizedJobPostingMediaType = 'text/plain; charset=utf-8'
export const normalizedJobPostingMaxBytes = 256 * 1_024
export const normalizedJobPostingJsonLdMaxBytes = 64 * 1_024

const ignoredVisibleTextElements = new Set([
  'canvas',
  'head',
  'noscript',
  'script',
  'style',
  'svg',
  'template',
])

const blockElements = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])

const metadataNames = [
  'description',
  'og:title',
  'og:description',
  'twitter:title',
  'twitter:description',
] as const

type MetadataName = (typeof metadataNames)[number]

const metadataLabels: Record<MetadataName, string> = {
  description: 'description',
  'og:title': 'Open Graph title',
  'og:description': 'Open Graph description',
  'twitter:title': 'Twitter title',
  'twitter:description': 'Twitter description',
}

type HtmlNode = ReturnType<typeof parseDocument>['children'][number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const inlineText = (value: string): string =>
  value.replaceAll('\u00a0', ' ').replace(/\s+/gu, ' ').trim()

const multilineText = (value: string): string =>
  value
    .replaceAll('\u00a0', ' ')
    .replace(/\r\n?/gu, '\n')
    .split(/\n+/gu)
    .map((line) => line.replace(/[\t\f\v ]+/gu, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')

const utf8Prefix = (value: string, maximumBytes: number): string => {
  let bytes = 0
  let end = 0

  while (end < value.length) {
    const codePoint = value.codePointAt(end)
    if (codePoint === undefined) break
    const width = codePoint > 0xffff ? 2 : 1
    const encodedWidth =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4
    if (bytes + encodedWidth > maximumBytes) break
    bytes += encodedWidth
    end += width
  }

  return value.slice(0, end)
}

export const boundJobPostingText = (
  value: string,
  maximumBytes: number,
  marker: string
): string => {
  const encoder = new TextEncoder()
  if (encoder.encode(value).byteLength <= maximumBytes) return value

  const markerBytes = encoder.encode(marker).byteLength
  if (markerBytes >= maximumBytes) return utf8Prefix(marker, maximumBytes)
  const prefix = utf8Prefix(value, Math.max(0, maximumBytes - markerBytes))
  return `${prefix.trimEnd()}${marker}`
}

const isHiddenElement = (node: HtmlNode): boolean => {
  if (!('name' in node) || !('attribs' in node)) return false
  if (ignoredVisibleTextElements.has(node.name)) return true
  if ('hidden' in node.attribs) return true
  if (node.attribs['aria-hidden']?.toLowerCase() === 'true') return true

  const style = node.attribs.style?.toLowerCase() ?? ''
  return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/u.test(
    style
  )
}

const visibleNodeText = (node: HtmlNode): string => {
  if (node.type === ElementType.Text && 'data' in node) return node.data
  if (isHiddenElement(node)) return ''
  if (!('children' in node)) return ''
  if ('name' in node && node.name === 'br') return '\n'

  const children = node.children.map(visibleNodeText).join('')
  return 'name' in node && blockElements.has(node.name)
    ? `\n${children}\n`
    : children
}

const canonicalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, canonicalizeJson(child)])
  )
}

const isJobPostingType = (value: unknown): boolean =>
  value === 'JobPosting' ||
  (Array.isArray(value) && value.some((item) => item === 'JobPosting'))

const collectJobPostingNodes = (value: unknown, output: unknown[]): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostingNodes(item, output)
    return
  }
  if (!isRecord(value)) return

  if (isJobPostingType(value['@type'])) output.push(value)
  for (const child of Object.values(value)) {
    collectJobPostingNodes(child, output)
  }
}

const parseJsonLd = (source: string): unknown | undefined => {
  try {
    const value: unknown = JSON.parse(source)
    return value
  } catch {
    return undefined
  }
}

const jsonLdContext = (
  document: ReturnType<typeof parseDocument>
): string | null => {
  const parsed = DomUtils.findAll(
    (element) =>
      element.name === 'script' &&
      element.attribs.type?.trim().toLowerCase() === 'application/ld+json',
    document.children
  )
    .map((script) => parseJsonLd(DomUtils.textContent(script)))
    .filter((value) => value !== undefined)

  if (parsed.length === 0) return null
  const jobPostings: unknown[] = []
  for (const value of parsed) collectJobPostingNodes(value, jobPostings)
  const selected = jobPostings.length > 0 ? jobPostings : parsed
  const value = selected.length === 1 ? selected[0] : selected
  const serialized = JSON.stringify(canonicalizeJson(value), null, 2)
  if (serialized === undefined) return null

  return boundJobPostingText(
    serialized,
    normalizedJobPostingJsonLdMaxBytes,
    '\n[JSON-LD truncated]'
  )
}

const pageMetadata = (
  document: ReturnType<typeof parseDocument>
): ReadonlyArray<readonly [MetadataName, string]> => {
  const values = new Map<MetadataName, string>()
  for (const element of DomUtils.findAll(
    (candidate) => candidate.name === 'meta',
    document.children
  )) {
    const name = (element.attribs.name ?? element.attribs.property)
      ?.trim()
      .toLowerCase()
    const metadataName = metadataNames.find((candidate) => candidate === name)
    if (metadataName === undefined || values.has(metadataName)) continue
    const content = inlineText(element.attribs.content ?? '')
    if (content.length > 0) values.set(metadataName, content)
  }

  return metadataNames.flatMap((name) => {
    const value = values.get(name)
    return value === undefined ? [] : [[name, value] as const]
  })
}

export const normalizeJobPostingHtml = (
  source: string,
  sourceUrl: string,
  maximumBytes = normalizedJobPostingMaxBytes
): string => {
  const document = parseDocument(source, { decodeEntities: true })
  const titleElement = DomUtils.findOne(
    (element) => element.name === 'title',
    document.children
  )
  const body = DomUtils.findOne(
    (element) => element.name === 'body',
    document.children
  )
  const title = titleElement
    ? inlineText(DomUtils.textContent(titleElement))
    : ''
  const metadata = pageMetadata(document)
  const jsonLd = jsonLdContext(document)
  const visibleText = multilineText(
    (body ? [body] : document.children).map(visibleNodeText).join('')
  )

  const sections = ['# Normalized job posting', `Source URL: ${sourceUrl}`]
  if (title.length > 0) sections.push(`## Page title\n${title}`)
  if (metadata.length > 0) {
    sections.push(
      `## Metadata\n${metadata
        .map(([name, value]) => `${metadataLabels[name]}: ${value}`)
        .join('\n')}`
    )
  }
  if (jsonLd !== null) sections.push(`## JSON-LD\n${jsonLd}`)
  if (visibleText.length > 0) {
    sections.push(`## Visible text\n${visibleText}`)
  }

  return boundJobPostingText(
    sections.join('\n\n'),
    maximumBytes,
    '\n\n[Job context truncated]'
  )
}
