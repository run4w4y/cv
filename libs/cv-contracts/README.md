# CV contracts

Code-owned, versioned Effect schemas shared by the CV renderer, management
frontend, and facts compiler.

The package intentionally has no root export. Import only the boundary needed
by a consumer:

```ts
import { CvDocumentV1Schema } from "@cv/contracts/document";
import { FactsCatalogueV1Schema } from "@cv/contracts/facts";
import { OpaqueInlineContentEnvelopeSchema } from "@cv/contracts/delivery";
```

The registry backend may use `@cv/contracts/delivery` to validate transport
metadata, but it must not import or inspect the document or facts contracts.

Contract IDs are immutable. Adding a new version means adding a new schema to
the corresponding registry while retaining every version needed by an active
publication or facts release.
