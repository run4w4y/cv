import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { CvFileLink } from '@/components/cv/file-link'
import {
  RedactedVariableSection,
  VariableLookupText,
} from '@/components/private-cv/redactions'

type MdxBlockProps = {
  children?: ReactNode
}

const MdxAnchor = ({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) =>
  href ? (
    <CvFileLink href={href} {...props}>
      {children}
    </CvFileLink>
  ) : (
    <a {...props}>{children}</a>
  )

export const cvMdxComponents = {
  Highlight: ({ children }: MdxBlockProps) => <li>{children}</li>,
  Highlights: ({ children }: MdxBlockProps) => <>{children}</>,
  RedactedSection: RedactedVariableSection,
  Summary: ({ children }: MdxBlockProps) => <>{children}</>,
  VariableLookup: VariableLookupText,
  Workstreams: ({ children }: MdxBlockProps) => <>{children}</>,
  a: MdxAnchor,
}
