declare global {
  interface CloudflareEnv {
    readonly CV_PUBLIC_RESOLVER_URL: string
    readonly CV_REVALIDATION_SECRET?: string
  }
}

export {}
