import {
  getContentElementKind,
  getContentElementProps,
  textFromChildren,
} from '@cv/content-authoring-utils'
import type {
  RedactedSectionDescriptor,
  VariableLookupDescriptor,
} from '@cv/content-core'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ActionLink } from '../model'

export type VariableLookupDescriptorInput = {
  fallback: string
  label?: string
  variable: string
}

export const variableLookup = ({
  fallback,
  label,
  variable,
}: VariableLookupDescriptorInput): VariableLookupDescriptor => ({
  fallback,
  kind: 'VariableLookup',
  ...(label === undefined ? {} : { label }),
  variable,
})

export type RedactedSectionDescriptorInput = {
  fallback: string
  title?: string
  variable: string
}

export const redactedSection = ({
  fallback,
  title,
  variable,
}: RedactedSectionDescriptorInput): RedactedSectionDescriptor => ({
  fallback,
  kind: 'RedactedSection',
  ...(title === undefined ? {} : { title }),
  variable,
})

export type LinkDescriptorInput = {
  children?: ReactNode
  href: string
  icon?: string
  label?: string
}

export const actionLinkFromProps = ({
  children,
  href,
  icon,
  label,
}: LinkDescriptorInput): ActionLink => {
  const renderedLabel = label ?? textFromChildren(children)

  return {
    href,
    ...(icon ? { icon } : {}),
    label: renderedLabel.length > 0 ? renderedLabel : href,
  }
}

export const isActionLinkElement = (
  value: ReactNode
): value is ReactElement<LinkDescriptorInput> =>
  isValidElement(value) && getContentElementKind(value) === 'Link'

export const actionLinkFromElement = (
  element: ReactElement<LinkDescriptorInput>
) => actionLinkFromProps(getContentElementProps<LinkDescriptorInput>(element))
