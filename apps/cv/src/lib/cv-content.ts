import {
  getContent as getPackagedCvContent,
  getLocales as getPackagedCvLocales,
} from 'virtual:content/generated/runtime'
import type { ProfileSlug } from '@cv/content-core'
import type { CvContent } from '@/cv-content/model'
import type { Locale } from './i18n'
import { isLocale } from './i18n'

type LoadCvOptions = {
  profile?: ProfileSlug
}

export const getLocales = async () => getPackagedCvLocales().filter(isLocale)

export const loadCv = async (
  locale: Locale,
  { profile = 'default' }: LoadCvOptions = {}
) => {
  return {
    alternates: await getLocales(),
    content: getPackagedCvContent<CvContent>({ locale, profile }),
  }
}
