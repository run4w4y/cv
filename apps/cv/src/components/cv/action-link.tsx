import { cn } from '@cv/ui/utils'
import type { AnchorHTMLAttributes } from 'react'
import { CvFileLink } from '@/components/cv/file-link'
import type { ActionLink } from '@/cv-content/model'
import { LinkArrowIcon, LinkIcon } from './link-icon'

type CvActionLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'children' | 'href'
> &
  ActionLink

export const cvActionLinkKey = (link: ActionLink) =>
  `${link.href}:${link.label}`

export const CvActionLink = ({
  className,
  href,
  icon,
  label,
  ...props
}: CvActionLinkProps) => (
  <CvFileLink
    className={cn(
      'inline-flex items-center gap-1.5 hover:text-foreground data-[cv-file-state=private-locked]:hover:text-muted-foreground',
      className
    )}
    href={href}
    {...props}
  >
    <LinkIcon href={href} icon={icon} label={label} />
    {label}
    <LinkArrowIcon />
  </CvFileLink>
)
