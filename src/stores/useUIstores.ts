import { create } from "zustand";

type SortRule = {
  columnId: string;
  direction: "asc" | "desc";
};

interface ColumnContextMenu {
  columnId: string;
  columnName: string;
  index: number;
}

interface UIState {
  // Table & View
  activeTableId: string | null;
  openDropdownId: string | null;

  // Selection
  selectedRows: Set<string>;
  selectedColIndex: number | null;
  allSelected: boolean;
  activeCell: { row: number; col: number } | null;

  // Column ops
  isAddingColumn: boolean;
  newColumnName: string;
  newColumnType: string;
  editColumnName: string;
  contextRow: string | null;
  columnContextMenu: ColumnContextMenu | null;

  // Visibility & Filters
  columnVisibility: Record<string, boolean>;
  filteredData: any[] | null;
  sortRules: SortRule[];
  sortedData: any[] | null;
  
  hovered: boolean;
  userProfile: boolean;

  // Setters
  set: (state: Partial<UIState>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Default values
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

  // Unified setter
  set: (state) => set((prev) => ({ ...prev, ...state })),
}));
