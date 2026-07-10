import { fileURLToPath } from 'node:url'

export const sourceDirectory = fileURLToPath(new URL('.', import.meta.url))
export const rootDirectory = fileURLToPath(new URL('../../..', import.meta.url))
