import { cn } from '@cv/ui/utils'
import type { ComponentType, ReactNode } from 'react'
import { DetailRow } from '@/components/cv/detail-row'
import { PrintKeyValueItem, PrintLink } from '@/components/cv/print/primitives'
import {
  isRedactedText,
  RedactedInlineText,
  RedactedSection,
} from '@/components/private-cv/redactions'
import type {
  ProfileBlock,
  ProfileDetailBlock,
  ProfileRedactedBlock,
} from '@/cv-content/model'

type ProfileBlockListProps = {
  blocks: readonly ProfileBlock[]
}

type ChildrenProps = {
  children?: ReactNode
}

type PrintProfileSectionProps = ChildrenProps & {
  className?: string
}

type ProfileBlockViewComponent = ComponentType<{ block: ProfileBlock }>

const blockKey = (block: ProfileBlock, index: number) => {
  if (block.type === 'detail') {
    return `${index}:detail:${block.label}`
  }

  if (block.type === 'redacted') {
    return `${index}:redacted:${block.descriptor.variable}`
  }

  return `${index}:${block.type}:${block.text}`
}

const ProfileRowTitle = ({ children }: ChildrenProps) => (
  <div
    className="border-b border-border px-6 py-5 md:px-8"
    data-profile-row-title
  >
    <h2 className="font-mono text-sm/6 font-semibold uppercase text-blue-600 dark:text-blue-400">
      {children}
    </h2>
  </div>
)

const ProfileDetailBlockView = ({ block }: { block: ProfileDetailBlock }) => (
  <DetailRow
    href={block.href}
    label={block.label}
    note={block.note}
    value={block.value}
  />
)

const ProfileRedactedBlockView = ({
  block,
}: {
  block: ProfileRedactedBlock
}) => (
  <RedactedSection descriptor={block.descriptor}>
    {block.items.map((item, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: Author-defined duplicate labels need a stable sibling discriminator.
      <ProfileDetailBlockView block={item} key={`${index}:${item.label}`} />
    ))}
  </RedactedSection>
)

const ProfileBlockView = ({ block }: { block: ProfileBlock }) => {
  switch (block.type) {
    case 'heading':
      return <h2>{block.text}</h2>
    case 'title':
      return <ProfileRowTitle>{block.text}</ProfileRowTitle>
    case 'text':
      return <p>{block.text}</p>
    case 'detail':
      return <ProfileDetailBlockView block={block} />
    case 'redacted':
      return <ProfileRedactedBlockView block={block} />
  }
}

export const ProfileBlockList = ({ blocks }: ProfileBlockListProps) => (
  <ProfileBlocks blocks={blocks} view={ProfileBlockView} />
)

export const PrintSidebarTitle = ({
  children,
  rowTitle = false,
}: ChildrenProps & { rowTitle?: boolean }) => (
  <h2
    className="m-0 mb-[1.7mm] font-mono text-[7.3pt]/[1.2] font-semibold text-blue-600 uppercase"
    data-profile-row-title={rowTitle ? true : undefined}
  >
    {children}
  </h2>
)

const ProfileBlocks = ({
  blocks,
  view: View,
}: ProfileBlockListProps & { view: ProfileBlockViewComponent }) => (
  <>
    {blocks.map((block, index) => (
      <View block={block} key={blockKey(block, index)} />
    ))}
  </>
)

const PrintProfileDetailBlock = ({ block }: { block: ProfileDetailBlock }) => {
  const value = <RedactedInlineText value={block.value} />

  return (
    <PrintKeyValueItem label={block.label}>
      {block.href && !isRedactedText(block.value) ? (
        <PrintLink href={block.href}>{value}</PrintLink>
      ) : (
        value
      )}
      {block.note ? (
        <span className="mt-[1.35mm] block font-sans text-[5.9pt]/[1.25] font-normal text-slate-500">
          {block.note}
        </span>
      ) : null}
    </PrintKeyValueItem>
  )
}

const PrintProfileRedactedBlock = ({
  block,
}: {
  block: ProfileRedactedBlock
}) => (
  <RedactedSection
    descriptor={block.descriptor}
    lockedBodyClassName="print:mt-[1.5mm]"
    lockedHeaderClassName="print:mb-[1.5mm]"
  >
    {block.items.map((item, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: Author-defined duplicate labels need a stable sibling discriminator.
      <PrintProfileDetailBlock block={item} key={`${index}:${item.label}`} />
    ))}
  </RedactedSection>
)

const PrintProfileBlock = ({ block }: { block: ProfileBlock }) => {
  switch (block.type) {
    case 'heading':
      return <PrintSidebarTitle>{block.text}</PrintSidebarTitle>
    case 'title':
      return <PrintSidebarTitle rowTitle>{block.text}</PrintSidebarTitle>
    case 'text':
      return (
        <p className="m-0 text-[7pt]/[1.35] text-slate-700">{block.text}</p>
      )
    case 'detail':
      return <PrintProfileDetailBlock block={block} />
    case 'redacted':
      return <PrintProfileRedactedBlock block={block} />
  }
}

export const PrintProfileBlockList = ({ blocks }: ProfileBlockListProps) => (
  <ProfileBlocks blocks={blocks} view={PrintProfileBlock} />
)

export const PrintProfileSection = ({
  children,
  className,
}: PrintProfileSectionProps) => (
  <section
    className={cn(
      'mb-[3mm] break-inside-avoid border-b-[0.25mm] border-slate-200 pb-[3mm] last:mb-0 last:border-b-0 last:pb-0',
      className
    )}
  >
    {children}
  </section>
)
