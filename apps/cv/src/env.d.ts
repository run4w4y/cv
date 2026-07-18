/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { CvPublicResolverBinding } from './lib/publication'

declare global {
  namespace Cloudflare {
    interface Env {
      readonly CV_PUBLIC_RESOLVER: CvPublicResolverBinding
    }
  }
}
