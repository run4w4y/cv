import { collectMdxBlocks } from '@cv/content-authoring-utils'
import type {
  ContentSectionSource,
  MdxContentComponent,
} from '@cv/content-composer'
import { cloneValue, mergeValue, requireField } from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'
import type { CvMdxBlocks } from '../authoring/blocks'
import type { CvSectionList } from '../model'
import type { RawSection } from '../schema/source'
import {
  type ContentLoadContext,
  type ContentValueSchema,
  decodeSourceValue,
  type SectionName,
  sectionItemCache,
} from './context'

type SectionEntryBase = {
  id: string
  order: number
  path: string
}

export type SectionMdxEntry<Item extends object> = SectionEntryBase & {
  component: MdxContentComponent
  meta: Partial<Item>
}

const orderedSectionBase = (section: ContentSectionSource) => {
  const orderedId = section.id.match(/^(?<order>\d+)-(?<id>.+)$/u)

  return {
    id: orderedId?.groups?.id ?? section.id,
    order: orderedId?.groups?.order
      ? Number(orderedId.groups.order)
      : Number.MAX_SAFE_INTEGER,
  }
}

const readMdxSectionEntry = <Item extends object>({
  context,
  metaSchema,
  section,
  sectionName,
}: {
  context: ContentLoadContext
  metaSchema?: ContentValueSchema<Partial<Item>>
  section: ContentSectionSource
  sectionName: SectionName | 'profile'
}): SectionMdxEntry<Item> => {
  const { id, order } = orderedSectionBase(section)

  if (section.kind !== 'mdx') {
    throw new Error(
      `${section.profile}/${section.locale}/${sectionName}/${section.id} must be an MDX section`
    )
  }

  const source = context.sources.readMdx<unknown>(section, section.modulePath)

  return {
    component: source.component,
    id,
    meta: metaSchema
      ? decodeSourceValue(metaSchema, source.meta ?? {}, source.relativePath)
      : {},
    order,
    path: source.relativePath,
  }
}

export const discoverMdxSectionEntries = <Item extends object>({
  context,
  locale,
  metaSchema,
  profile,
  sectionName,
}: {
  context: ContentLoadContext
  locale: Locale
  metaSchema?: ContentValueSchema<Partial<Item>>
  profile: ProfileSlug
  sectionName: SectionName | 'profile'
}): SectionMdxEntry<Item>[] =>
  context.repository
    .listSourceChildren(locale, profile, [sectionName])
    .map((section) =>
      readMdxSectionEntry<Item>({
        context,
        metaSchema,
        section,
        sectionName,
      })
    )
    .sort((left, right) =>
      left.order === right.order
        ? left.id.localeCompare(right.id)
        : left.order - right.order
    )

export type ApplyMdx<Item extends object> = (
  item: Partial<Item>,
  blocks: CvMdxBlocks
) => Partial<Item>

const loadMdxSectionItem = <Item extends object>({
  applyMdx,
  context,
  entry,
  includeEntryId = true,
  sectionName,
}: {
  applyMdx: ApplyMdx<Item>
  context: ContentLoadContext
  entry: SectionMdxEntry<Item>
  includeEntryId?: boolean
  sectionName: SectionName
}): Partial<Item> => {
  const cache = sectionItemCache<Item>(context, sectionName)
  const cached = cache.get(entry.path)

  if (cached) {
    return cloneValue(cached)
  }

  const blocks = collectMdxBlocks<CvMdxBlocks>(entry.component, entry.path)
  const item = applyMdx(
    includeEntryId
      ? {
          ...entry.meta,
          id: entry.id,
        }
      : entry.meta,
    blocks
  )

  cache.set(entry.path, cloneValue(item))

  return cloneValue(item)
}

const hasEntryId = <Item extends object>(
  item: Item
): item is Item & { id: string } => 'id' in item && typeof item.id === 'string'

const materializeMdxEntries = <Item extends object>({
  applyMdx,
  baseItems = [],
  context,
  entries,
  includeEntryId = true,
  itemDefaults,
  itemSchema,
  sectionName,
}: {
  applyMdx: ApplyMdx<Item>
  baseItems?: readonly Item[]
  context: ContentLoadContext
  entries: readonly SectionMdxEntry<Item>[]
  includeEntryId?: boolean
  itemDefaults?: Partial<Item>
  itemSchema: ContentValueSchema<Item>
  sectionName: SectionName
}) => {
  const baseById = new Map(
    baseItems.filter(hasEntryId).map((item) => [item.id, item])
  )

  return entries.map((entry) => {
    const inherited =
      baseById.get(entry.id) ?? (includeEntryId ? { id: entry.id } : {})
    const local = loadMdxSectionItem({
      applyMdx,
      context,
      entry,
      includeEntryId,
      sectionName,
    })
    const merged = mergeValue(mergeValue(itemDefaults ?? {}, inherited), local)

    return decodeSourceValue(itemSchema, merged, entry.path)
  })
}

export const materializeBaseMdxSection = <Item extends object>({
  applyMdx,
  context,
  includeEntryId = true,
  itemDefaults,
  itemSchema,
  locale,
  metaSchema,
  profile,
  raw,
  sectionName,
  sectionPath,
}: {
  applyMdx: ApplyMdx<Item>
  context: ContentLoadContext
  includeEntryId?: boolean
  itemDefaults?: Partial<Item>
  itemSchema: ContentValueSchema<Item>
  locale: Locale
  metaSchema: ContentValueSchema<Partial<Item>>
  profile: ProfileSlug
  raw: RawSection
  sectionName: SectionName
  sectionPath: string
}): CvSectionList<Item> => {
  const section = requireField(raw, sectionPath)
  const entries = discoverMdxSectionEntries<Item>({
    context,
    locale,
    metaSchema,
    profile,
    sectionName,
  })

  return {
    ...(section as Omit<CvSectionList<Item>, 'items'>),
    items: materializeMdxEntries({
      applyMdx,
      context,
      entries,
      includeEntryId,
      itemDefaults,
      itemSchema,
      sectionName,
    }),
  }
}

export const mergeMdxSection = <Item extends object>({
  applyMdx,
  base,
  context,
  includeEntryId = true,
  itemDefaults,
  itemSchema,
  locale,
  metaSchema,
  override,
  profile,
  sectionName,
}: {
  applyMdx: ApplyMdx<Item>
  base: CvSectionList<Item>
  context: ContentLoadContext
  includeEntryId?: boolean
  itemDefaults?: Partial<Item>
  itemSchema: ContentValueSchema<Item>
  locale: Locale
  metaSchema: ContentValueSchema<Partial<Item>>
  override: RawSection
  profile: ProfileSlug
  sectionName: SectionName
}): CvSectionList<Item> => {
  const entries = discoverMdxSectionEntries<Item>({
    context,
    locale,
    metaSchema,
    profile,
    sectionName,
  })
  const section = mergeValue(base, override)

  if (entries.length === 0) {
    return {
      ...section,
      items: cloneValue(base.items),
    }
  }

  return {
    ...section,
    items: materializeMdxEntries({
      applyMdx,
      baseItems: base.items,
      context,
      entries,
      includeEntryId,
      itemDefaults,
      itemSchema,
      sectionName,
    }),
  }
}
