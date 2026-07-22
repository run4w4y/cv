export const retryDelaySeconds = (
  attempts: number,
  retryAfterSeconds?: number
): number =>
  retryAfterSeconds ?? Math.min(300, 20 * 2 ** Math.max(0, attempts - 1))
