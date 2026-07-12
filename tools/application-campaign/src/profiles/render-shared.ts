export const profileSummaryCharacterBudget = 16_000

export type AuthoredProfileSource = {
  readonly kind: 'mdx' | 'module'
  readonly modulePath: string
  readonly path: readonly string[]
  readonly source: string
}

export type AuthoredProfileLayer = {
  readonly profile: string
  readonly sources: readonly AuthoredProfileSource[]
}

export type AuthoredSharedSource = {
  readonly modulePath: string
  readonly source: string
}

export type LayeredProfileContent = {
  readonly defaultProfile: string
  readonly layers: readonly AuthoredProfileLayer[]
  readonly locale: string
  readonly profile: string
  readonly sharedSources: readonly AuthoredSharedSource[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const authoredSource = (value: unknown): AuthoredProfileSource | undefined => {
  if (
    !isRecord(value) ||
    (value.kind !== 'mdx' && value.kind !== 'module') ||
    typeof value.modulePath !== 'string' ||
    !isStringArray(value.path) ||
    typeof value.source !== 'string'
  ) {
    return undefined
  }

  return {
    kind: value.kind,
    modulePath: value.modulePath,
    path: value.path,
    source: value.source,
  }
}

const authoredLayer = (value: unknown): AuthoredProfileLayer | undefined => {
  if (
    !isRecord(value) ||
    typeof value.profile !== 'string' ||
    !Array.isArray(value.sources)
  ) {
    return undefined
  }

  const sources = value.sources.map(authoredSource)

  return sources.every((source) => source !== undefined)
    ? { profile: value.profile, sources }
    : undefined
}

const authoredSharedSource = (
  value: unknown
): AuthoredSharedSource | undefined => {
  if (
    !isRecord(value) ||
    typeof value.modulePath !== 'string' ||
    typeof value.source !== 'string'
  ) {
    return undefined
  }

  return { modulePath: value.modulePath, source: value.source }
}

export const layeredProfileContent = (
  value: unknown
): LayeredProfileContent | undefined => {
  if (
    !isRecord(value) ||
    typeof value.defaultProfile !== 'string' ||
    !Array.isArray(value.layers) ||
    typeof value.locale !== 'string' ||
    typeof value.profile !== 'string' ||
    !Array.isArray(value.sharedSources)
  ) {
    return undefined
  }

  const layers = value.layers.map(authoredLayer)
  const sharedSources = value.sharedSources.map(authoredSharedSource)

  if (
    layers.some((layer) => layer === undefined) ||
    sharedSources.some((source) => source === undefined)
  ) {
    return undefined
  }

  return {
    defaultProfile: value.defaultProfile,
    layers: layers.filter(
      (layer): layer is AuthoredProfileLayer => layer !== undefined
    ),
    locale: value.locale,
    profile: value.profile,
    sharedSources: sharedSources.filter(
      (source): source is AuthoredSharedSource => source !== undefined
    ),
  }
}

const json = (value: unknown) => JSON.stringify(value, null, 2) ?? String(value)

const longestBacktickRun = (value: string) =>
  Math.max(0, ...(value.match(/`+/gu)?.map((run) => run.length) ?? []))

const fenced = (source: string, language: string) => {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(source) + 1))

  return `${fence}${language}\n${source}\n${fence}`
}

const sourceLanguage = (
  source: Pick<AuthoredProfileSource, 'kind' | 'modulePath'>
) => {
  if (source.kind === 'mdx') {
    return 'mdx'
  }

  const extension = source.modulePath.split('.').at(-1)?.toLowerCase()

  return extension === 'ts' ||
    extension === 'tsx' ||
    extension === 'js' ||
    extension === 'jsx'
    ? extension
    : 'text'
}

const renderSource = (
  source: AuthoredProfileSource,
  renderedSource = source.source,
  headingLevel = 3
) => {
  const path = source.path.length > 0 ? source.path.join(' / ') : undefined

  return [
    `${'#'.repeat(headingLevel)} Source: ${source.modulePath}`,
    path ? `Content path: ${path}` : undefined,
    fenced(renderedSource, sourceLanguage(source)),
  ]
    .filter((block): block is string => block !== undefined)
    .join('\n\n')
}

const renderProfileLayerWithSourceBudget = (
  layer: AuthoredProfileLayer,
  headingLevel: number,
  sourceCharacterBudget: number | undefined
) => {
  const rendered: string[] = []
  let used = 0
  let omitted = 0

  for (const source of layer.sources) {
    const remaining =
      sourceCharacterBudget === undefined
        ? undefined
        : Math.max(0, sourceCharacterBudget - used)

    if (remaining === 0) {
      omitted += source.source.length
      continue
    }

    const renderedSource =
      remaining === undefined || source.source.length <= remaining
        ? source.source
        : source.source.slice(0, remaining)
    used += renderedSource.length
    omitted += source.source.length - renderedSource.length
    rendered.push(renderSource(source, renderedSource, headingLevel + 1))
  }

  const truncation =
    omitted > 0
      ? `> ${omitted.toLocaleString('en-US')} source characters were omitted from this compact context.`
      : undefined

  return [
    `${'#'.repeat(headingLevel)} Authored layer: ${layer.profile}`,
    ...rendered,
    truncation,
  ]
    .filter((block): block is string => block !== undefined)
    .join('\n\n')
}

const fitRenderedBudget = ({
  budget,
  render,
  sourceLength,
}: {
  readonly budget: number
  readonly render: (sourceCharacterBudget: number) => string
  readonly sourceLength: number
}) => {
  const complete = render(sourceLength)

  if (complete.length <= budget) {
    return complete
  }

  let lower = 0
  let upper = sourceLength
  let best = render(0)

  if (best.length > budget) {
    const notice =
      '> Compact context omitted to stay within the rendering budget.'

    return notice.length <= budget ? notice : ''
  }

  while (lower <= upper) {
    const candidateBudget = Math.floor((lower + upper) / 2)
    const candidate = render(candidateBudget)

    if (candidate.length <= budget) {
      best = candidate
      lower = candidateBudget + 1
    } else {
      upper = candidateBudget - 1
    }
  }

  return best
}

export const renderProfileLayer = (
  layer: AuthoredProfileLayer,
  options: {
    readonly headingLevel?: number
    readonly renderedCharacterBudget?: number
  } = {}
) => {
  const headingLevel = options.headingLevel ?? 2
  const renderedCharacterBudget = options.renderedCharacterBudget

  if (renderedCharacterBudget === undefined) {
    return renderProfileLayerWithSourceBudget(layer, headingLevel, undefined)
  }

  return fitRenderedBudget({
    budget: renderedCharacterBudget,
    render: (sourceCharacterBudget) =>
      renderProfileLayerWithSourceBudget(
        layer,
        headingLevel,
        sourceCharacterBudget
      ),
    sourceLength: layer.sources.reduce(
      (length, source) => length + source.source.length,
      0
    ),
  })
}

export const selectProfileSummaryLayer = (
  content: LayeredProfileContent,
  profile: string
) => {
  const selected = content.layers.find((layer) => layer.profile === profile)

  if (selected?.sources.length) {
    return selected
  }

  return content.layers.find(
    (layer) => layer.profile === content.defaultProfile
  )
}

export const renderSharedSources = (sources: readonly AuthoredSharedSource[]) =>
  sources
    .map((source) => {
      const kind = source.modulePath.endsWith('.mdx') ? 'mdx' : 'module'

      return renderSource({ ...source, kind, path: [] }, source.source, 2)
    })
    .join('\n\n')

/** The profile source is trusted; the Markdown is only transport for an LLM. */
export const renderJsonMarkdown = (value: unknown) =>
  fenced(json(value), 'json')

export const renderJsonSummaryMarkdown = (
  value: unknown,
  renderedCharacterBudget = profileSummaryCharacterBudget
) => {
  const serialized = json(value)

  return fitRenderedBudget({
    budget: renderedCharacterBudget,
    render: (sourceCharacterBudget) => {
      const rendered = serialized.slice(0, sourceCharacterBudget)
      const omitted = serialized.length - rendered.length

      return [
        fenced(rendered, 'json'),
        omitted > 0
          ? `> ${omitted.toLocaleString('en-US')} source characters were omitted from this compact context.`
          : undefined,
      ]
        .filter((block): block is string => block !== undefined)
        .join('\n\n')
    },
    sourceLength: serialized.length,
  })
}
