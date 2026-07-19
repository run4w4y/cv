export const messageFromCause = (cause: unknown, fallback: string): string =>
  cause instanceof Error ? cause.message : fallback
