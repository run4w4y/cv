import { ArrowUpRight, FileText } from 'lucide-react'
import { TechIcon } from './tech-icon'

type LinkIconProps = {
  href: string
  icon?: string
  label: string
}

export const LinkIcon = ({ href, icon, label }: LinkIconProps) => {
  const normalizedLabel = label.toLowerCase()
  const isGitHub =
    icon === 'github' ||
    href.includes('github.com') ||
    normalizedLabel.includes('github') ||
    normalizedLabel.includes('source')
  const isDocument =
    icon === 'document' ||
    href.endsWith('.pdf') ||
    normalizedLabel.includes('pdf')

  if (isGitHub) {
    return <TechIcon iconSlot="inline-start" name="GitHub" />
  }

  if (isDocument) {
    return (
      <FileText
        aria-hidden="true"
        className="size-3.5"
        data-icon="inline-start"
        strokeWidth={1.7}
      />
    )
  }

  return null
}

export const LinkArrowIcon = () => (
  <ArrowUpRight
    aria-hidden="true"
    className="size-3.5 group-data-[cv-file-state=private-locked]/cv-file:hidden"
    data-icon="inline-end"
    strokeWidth={1.7}
  />
)
