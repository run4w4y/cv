import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../..', import.meta.url))
export const cvAppRoot = join(root, 'apps', 'cv')

export const publicPdfOutDir = join(cvAppRoot, 'dist', 'pdf')
export const privatePdfOutDir = join(cvAppRoot, 'dist', 'private-pdf')
