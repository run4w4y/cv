declare module '*/.open-next/worker.js' {
  const worker: {
    readonly fetch: (
      request: Request,
      env: unknown,
      context: unknown
    ) => Promise<Response>
  }

  export default worker
}

declare module 'cloudflare:workers' {
  type CachePurgeOptions =
    | { readonly purgeEverything: true }
    | { readonly tags: readonly string[] }

  type CachePurgeResult = {
    readonly errors: readonly {
      readonly code: number
      readonly message: string
    }[]
    readonly success: boolean
  }

  export const cache: {
    readonly purge: (options: CachePurgeOptions) => Promise<CachePurgeResult>
  }
}
