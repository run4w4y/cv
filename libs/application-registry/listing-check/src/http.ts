import { Effect } from 'effect'

export type ListingFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export type ListingFetchResult = {
  readonly body: string
  readonly finalUrl: string
  readonly status: number
}

export const fetchListingPage = (url: string, fetcher: ListingFetch) =>
  Effect.tryPromise({
    try: async (signal): Promise<ListingFetchResult> => {
      const response = await fetcher(url, {
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': 'cv-application-registry-listing-checker/1',
        },
        redirect: 'follow',
        signal,
      })
      return {
        body: await response.text(),
        finalUrl: response.url || url,
        status: response.status,
      }
    },
    catch: (cause) => cause,
  })

export const hashListingContent = (value: string) =>
  Effect.tryPromise({
    try: () => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    catch: (cause) => cause,
  }).pipe(
    Effect.map((digest) =>
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    )
  )
