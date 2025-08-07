import { create } from "zustand";

type SortRule = {
  columnId: string;
  direction: "asc" | "desc";
};

interface RowData {
  id: string;
  cells: {
    id: string;
    columnId: string;
    rowId: string;
    value: string | number | boolean | null;
  }[];
}

interface ColumnContextMenu {
  columnId: string;
  columnName: string;
  index: number;
}

interface UIState {
  // Table and View
  activeTableId: string | null;
  openDropdownId: string | null;

  // Selection
  selectedRows: Set<string>;
  selectedColIndex: number | null;
  allSelected: boolean;
  activeCell: { row: number; col: number } | null;

  // Column 
  isAddingColumn: boolean;
  newColumnName: string;
  newColumnType: string;
  editColumnName: string;
  contextRow: string | null;
  columnContextMenu: ColumnContextMenu | null;

  // Visibility and Filters
  columnVisibility: Record<string, boolean>;
  filteredData: RowData[] | null;
  sortRules: SortRule[];
  sortedData: RowData[] | null;
  
  hovered: boolean;
  userProfile: boolean;

  // Editable Cell
  isFocused: boolean;

  // Setters
  set: (state: Partial<UIState>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTableId: null,
  openDropdownId: null,
  selectedRows: new Set(),
  selectedColIndex: null,
  allSelected: false,
  activeCell: null,
  isAddingColumn: false,
  newColumnName: "New Column",
  newColumnType: "text",
  editColumnName: "",
  contextRow: null,
  columnContextMenu: null,
  columnVisibility: {},
  filteredData: null,
  sortRules: [],
  sortedData: null,
  hovered: false,
  userProfile: false,
  isFocused: false,

  // Unified setter
  set: (state) => set((prev) => ({ ...prev, ...state })),
}));
