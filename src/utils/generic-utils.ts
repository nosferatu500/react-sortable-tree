export const slideRows = (rows: any[], fromIndex: number, toIndex: number, count = 1) => {
    const rowsWithoutMoved = [...rows.slice(0, fromIndex), ...rows.slice(fromIndex + count)];

    return [
        ...rowsWithoutMoved.slice(0, toIndex),
        ...rows.slice(fromIndex, fromIndex + count),
        ...rowsWithoutMoved.slice(toIndex),
    ];
};
