import type { CvPublicResolverBinding } from './lib/publication'

declare global {
  interface CloudflareEnv {
    readonly CV_PUBLIC_RESOLVER: CvPublicResolverBinding
    readonly CV_REVALIDATION_SECRET?: string
  }
}
