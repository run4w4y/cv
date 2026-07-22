import type { CvContactLinkV1, CvDocumentV1 } from '@cv/contracts/document'
import type { ReactNode } from 'react'

type KeyedText = {
  readonly key: string
  readonly value: string
}

const keyedTexts = (
  values: ReadonlyArray<string>
): ReadonlyArray<KeyedText> => {
  const occurrences = new Map<string, number>()

  return values.map((value) => {
    const occurrence = occurrences.get(value) ?? 0
    occurrences.set(value, occurrence + 1)
    return { key: `${value}\u0000${occurrence}`, value }
  })
}

export const idFragment = (value: string) => {
  const encoded = value.replaceAll(/[^A-Za-z0-9-]/gu, (character) =>
    Array.from(character)
      .map((part) => `_x${part.codePointAt(0)?.toString(16)}_`)
      .join('')
  )

  return encoded || 'cv'
}

const ContactValue = ({ contact }: { readonly contact: CvContactLinkV1 }) =>
  contact.href ? (
    <a href={contact.href}>{contact.value}</a>
  ) : (
    <span>{contact.value}</span>
  )

export const Contacts = ({
  contacts,
  label,
}: {
  readonly contacts: CvDocumentV1['person']['contacts']
  readonly label: string
}) => {
  const occurrences = new Map<string, number>()

  return (
    <address aria-label={label} className="cv2-contacts">
      <ul className="cv2-contact-list">
        {contacts.map((contact) => {
          const signature = [
            contact.kind,
            contact.label,
            contact.value,
            contact.href ?? '',
          ].join('\u0000')
          const occurrence = occurrences.get(signature) ?? 0
          occurrences.set(signature, occurrence + 1)

          return (
            <li
              className="cv2-contact-item"
              key={`${signature}\u0000${occurrence}`}
            >
              <span className="cv2-contact-label">{contact.label}</span>
              <ContactValue contact={contact} />
            </li>
          )
        })}
      </ul>
    </address>
  )
}

export const Section = ({
  children,
  heading,
  id,
}: {
  readonly children: ReactNode
  readonly heading: string
  readonly id: string
}) => (
  <section aria-labelledby={id} className="cv2-section">
    <h2 className="cv2-section-heading" id={id}>
      {heading}
    </h2>
    {children}
  </section>
)

export const Technologies = ({
  items,
  label,
}: {
  readonly items: ReadonlyArray<string>
  readonly label: string
}) =>
  items.length === 0 ? null : (
    <ul aria-label={label} className="cv2-chip-list">
      {keyedTexts(items).map((item) => (
        <li className="cv2-chip" key={item.key}>
          {item.value}
        </li>
      ))}
    </ul>
  )

export const Highlights = ({
  items,
  label,
}: {
  readonly items: ReadonlyArray<string>
  readonly label: string
}) =>
  items.length === 0 ? null : (
    <ul aria-label={label} className="cv2-highlights">
      {keyedTexts(items).map((item) => (
        <li className="cv2-highlight" key={item.key}>
          {item.value}
        </li>
      ))}
    </ul>
  )

export const ProjectLinks = ({
  links,
  label,
}: {
  readonly links: ReadonlyArray<CvContactLinkV1>
  readonly label: string
}) => {
  if (links.length === 0) return null

  const occurrences = new Map<string, number>()

  return (
    <ul aria-label={label} className="cv2-link-list">
      {links.map((link) => {
        const signature = [
          link.kind,
          link.label,
          link.value,
          link.href ?? '',
        ].join('\u0000')
        const occurrence = occurrences.get(signature) ?? 0
        occurrences.set(signature, occurrence + 1)

        return (
          <li key={`${signature}\u0000${occurrence}`}>
            {link.href ? <a href={link.href}>{link.label}</a> : link.value}
          </li>
        )
      })}
    </ul>
  )
}
