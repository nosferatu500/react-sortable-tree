export const slideRows = <T>(
  rows: T[],
  fromIndex: number,
  toIndex: number,
  count = 1
): T[] => {
  const movedItems = rows.slice(fromIndex, fromIndex + count)
  const rowsWithoutMoved = rows.toSpliced(fromIndex, count)

  return rowsWithoutMoved.toSpliced(toIndex, 0, ...movedItems)
}
