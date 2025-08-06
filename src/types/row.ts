// Raw row from backend (used in Zustand, API)
export interface BackendRow {
  id: string;
  cells: {
    id: string;
    columnId: string;
    rowId: string;
    value: string | number | boolean | null;
  }[];
}

// Flattened row for TanStack Table display
export type FlattenedRow = Record<string, unknown> & {
  id: string;
};
