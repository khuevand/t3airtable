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
  columnVisibility: Record<string, boolean>;

  // Search
  searchTerm: string;

  // Backend Filter & Sort Results
  filteredData: RowData[] | null;
  sortedData: RowData[] | null;
  sortRules: SortRule[] | null;
  
  // UI State
  hovered: boolean;
  userProfile: boolean;
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
  searchTerm: "",
  filteredData: null,
  sortedData: null,
  sortRules: null,
  hovered: false,
  userProfile: false,
  isFocused: false,

  // Unified setter
  set: (state) => set((prev) => ({ ...prev, ...state })),
}));