import { createColorSchemeBootScript } from '@cv/color-scheme/script'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

export const CvHtmlDocument = async ({
  children,
  direction = 'ltr',
  language = 'en',
}: {
  readonly children: ReactNode
  readonly direction?: string
  readonly language?: string
}) => {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html dir={direction} lang={language} suppressHydrationWarning>
      <head>
        <script
          // The source is owned and tested by @cv/color-scheme.
          id="cv-color-scheme-boot"
          nonce={nonce}
          // Browsers deliberately hide nonce attribute values from the DOM.
          suppressHydrationWarning
        >
          {createColorSchemeBootScript()}
        </script>
      </head>
      <body>{children}</body>
    </html>
  )
}
