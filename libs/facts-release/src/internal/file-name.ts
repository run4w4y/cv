export const isSafeAssetFileName = (fileName: string) => {
  const containsForbiddenCharacter = [...fileName].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return (
      codePoint <= 31 ||
      codePoint === 127 ||
      character === '/' ||
      character === '\\'
    )
  })

  return (
    fileName === fileName.trim() &&
    fileName.length >= 1 &&
    fileName.length <= 255 &&
    fileName !== '.' &&
    fileName !== '..' &&
    !containsForbiddenCharacter
  )
}
