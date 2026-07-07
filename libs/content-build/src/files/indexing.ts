import { uniq } from 'es-toolkit/array'
import { mangleProfileId } from '../ids'
import type { ContentFile, ContentFileIndex } from './model'

const publicProfileId = (profile: string, salt: string) =>
  mangleProfileId(profile, salt)

const sortedUnique = (paths: readonly string[]) =>
  uniq(paths).sort((left, right) => left.localeCompare(right))

type MutableContentFileIndex = {
  profiles: Record<string, string[]>
  public: string[]
}

export const toFileIndex = (
  files: readonly ContentFile[],
  salt: string
): ContentFileIndex => {
  const index: MutableContentFileIndex = {
    profiles: {},
    public: [],
  }

  for (const file of files) {
    if (file.scope === 'public') {
      index.public.push(file.relativePath)
    } else if (file.profile) {
      const profile = publicProfileId(file.profile, salt)

      index.profiles[profile] = [
        ...(index.profiles[profile] ?? []),
        file.relativePath,
      ]
    }
  }

  return {
    profiles: Object.fromEntries(
      Object.entries(index.profiles)
        .map(
          ([profile, paths]) =>
            [profile, sortedUnique(paths)] satisfies [string, string[]]
        )
        .sort(([left], [right]) => left.localeCompare(right))
    ),
    public: sortedUnique(index.public),
  }
}
