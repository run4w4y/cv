# CV renderer

The schema-aware presentation boundary for `cv.document.v1`. It renders the
same deterministic React tree for the public Astro Worker, management preview,
and Browser Rendering PDF pass.

```tsx
import {
  CvDocumentRenderer,
  type CvDocumentRendererProps,
} from '@cv/renderer'

const preview = (
  <CvDocumentRenderer
    document={document}
    publicUrl="https://example.com/c/public-token"
    mode="print-preview"
  />
)
```

The component includes its scoped stylesheet by default. When several
documents share a page, render `CvRendererStyleSheet` once and pass
`includeStyles={false}` to each document.

`publicUrl` is used byte-for-byte as the QR payload and link target. The
renderer never constructs, normalizes, or replaces the publication token.
