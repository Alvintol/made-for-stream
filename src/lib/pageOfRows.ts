export type PageOfRows<Row, Cursor> = {
  rows: Row[];
  next: Cursor | null;
};

// The database returns one row more than asked for. That extra row is how the
// site knows another page exists, and it is never shown: the next page starts
// after the last row that was.
export const toPageOfRows = <Row, Cursor>(
  rows: Row[],
  pageSize: number,
  getCursor: (lastRow: Row) => Cursor
): PageOfRows<Row, Cursor> => {
  const shown = rows.slice(0, pageSize);
  const lastRow = shown.at(-1);

  return {
    rows: shown,
    next: rows.length > pageSize && lastRow !== undefined ? getCursor(lastRow) : null,
  };
};
