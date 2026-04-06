export const slideRows = (
  rows: unknown[],
  fromIndex: number,
  toIndex: number,
  count = 1
): unknown[] => {
  const movedItems = rows.slice(fromIndex, fromIndex + count)
  const rowsWithoutMoved = rows.toSpliced(fromIndex, count)

  return rowsWithoutMoved.toSpliced(toIndex, 0, ...movedItems)
}
