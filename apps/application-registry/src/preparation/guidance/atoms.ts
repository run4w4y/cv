import {
  type CvGenerationGuidanceV1,
  CvGenerationGuidanceV1Schema,
} from '@cv/contracts/document'
import { Result, Schema } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

const overrideFamily = Atom.family((factsReleaseId: string) =>
  Atom.make<CvGenerationGuidanceV1 | null>(null).pipe(
    Atom.withLabel(`preparation/guidance/override/${factsReleaseId}`),
    Atom.keepAlive
  )
)

export const cvGenerationGuidanceOverrideAtom = (factsReleaseId: string) =>
  overrideFamily(factsReleaseId)

export const cvGenerationGuidanceChanged = (
  base: CvGenerationGuidanceV1,
  value: CvGenerationGuidanceV1
): boolean => JSON.stringify(base) !== JSON.stringify(value)

export const isValidCvGenerationGuidance = (
  value: CvGenerationGuidanceV1
): boolean =>
  Result.isSuccess(
    Schema.decodeUnknownResult(CvGenerationGuidanceV1Schema)(value)
  )
