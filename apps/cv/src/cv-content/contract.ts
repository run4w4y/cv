import { fileURLToPath } from 'node:url'
import type {
  ContentContract,
  ContentPrivacyAdapter,
} from '@cv/content-composer'
import { collectVariableUseDescriptors } from '@cv/content-core'
import { composeCvAppContent } from './compose/index'
import type { CvContent } from './model'
import { cvContentSchema, cvContentSchemaVersion } from './schema/registry'

const authoringModule = fileURLToPath(
  new URL('./authoring/components.tsx', import.meta.url)
)

const cvContentPrivacy = {
  collectVariables: ({ content }) => collectVariableUseDescriptors(content),
} satisfies ContentPrivacyAdapter<CvContent>

export const cvContentContract = {
  authoringModule,
  compose: composeCvAppContent,
  contentDir: 'content',
  contentSchema: cvContentSchema,
  contentSchemaVersion: cvContentSchemaVersion,
  defaultLocale: 'en',
  defaultProfile: 'default',
  privacy: cvContentPrivacy,
} satisfies ContentContract<CvContent>
