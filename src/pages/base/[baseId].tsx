import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { CellContext } from "@tanstack/react-table";
import { isCancelledError } from "@tanstack/react-query";
import {ChevronDown,
        CheckSquare,
        Square,
        Search,
        Settings,
        Table,
        ArrowLeft,
        Info,
        Bell,
        Plus,
        History} from "lucide-react";
import { api } from "~/utils/api";
import { useParams } from "next/navigation";
import Image from "next/image";
import { toast } from "react-toastify";
import { useDebounce } from "use-debounce";
import TableToolbar from "~/components/tableToolBar";
import { highlightSearchTerm } from "~/components/highlightSearchTerm";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useUIStore } from "~/stores/useUIstores";
import type { BackendRow, FlattenedRow } from "~/types/row";

// ========================================================================================
// TYPE DEFINITIONS AND COLOR PICK
// ========================================================================================

interface Table {
  id: string;
  name: string;
}

type SortDirection = "asc" | "desc";

interface EditableCellProps {
  initialValue: string;
  tableId: string;
  rowId: string;
  columnId: string;
  searchTerm?: string;
}

// ========================================================================================
// EDITABLE CELL COMPONENT
// ========================================================================================

const EditableCell: React.FC<EditableCellProps> = ({
  initialValue,
  rowId,
  columnId,
  searchTerm = '',
}) => {
  // State
  const [value, setValue] = useState(initialValue ?? '');
  const [isEditing, setIsEditing] = useState(false);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  
  // API
  const updateCell = api.cell.updateCell.useMutation();

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (value !== initialValue) {
      updateCell.mutate({ rowId, columnId, value: value || null });
    }
  }, [value, initialValue, updateCell, rowId, columnId]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setValue(initialValue || '');
      inputRef.current?.blur();
    }
  }, [initialValue]);

  const highlightedText = useMemo(() => 
    highlightSearchTerm(String(value || ''), searchTerm), 
    [value, searchTerm]
  );

  return (
    <div className="relative w-full min-h-[32px] flex items-center">
      {isEditing ? (
        // Show input when editing
        <input
          ref={inputRef}
          className="w-full h-full border-none bg-transparent text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 px-1"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        // Show display version when not editing
        <div 
          className="w-full h-full px-1 py-1 cursor-text flex items-center min-h-[32px]"
          onClick={handleFocus}
          onDoubleClick={handleFocus}
        >
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
          ) : null}
        </div>
      )}
    </div>
  );
};

// ========================================================================================
// MAIN COMPONENT
// ========================================================================================

export default function BasePage() {
  // ========================================================================================
  // HOOKS & REFS - Move all hooks to the top
  // ========================================================================================
  
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { isLoaded, isSignedIn } = useUser();

  // Early returns should come after all hooks
  const baseId = params?.baseId as string;

  // Refs
  const tableRef = useRef<HTMLDivElement>(null);
  const isColumnOperationRef = useRef(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // API utils
  const utils = api.useUtils();

  // ========================================================================================
  // STATE MANAGEMENT
  // ========================================================================================
  
  // Side bar state
  const hovered = useUIStore((state) => state.hovered);

  // Table state
  const activeTableId = useUIStore((state) => state.activeTableId);
  const openDropdownId = useUIStore((state) => state.openDropdownId);

  // Selection state
  const selectedRows = useUIStore((state) => state.selectedRows);
  const selectedColIndex = useUIStore((state) => state.selectedColIndex);
  const allSelected = useUIStore((state) => state.allSelected);

  // Column operations state
  const isAddingColumn = useUIStore((state) => state.isAddingColumn);
  const newColumnName = useUIStore((state) => state.newColumnName);
  const newColumnType = useUIStore((state) => state.newColumnType);
  const editColumnName = useUIStore((state) => state.editColumnName);
  const contextRow = useUIStore((state) => state.contextRow);

  // Visibility state
  const columnVisibility = useUIStore((state) => state.columnVisibility);

  // Filter & sort state
  const filteredData = useUIStore((state) => state.filteredData);
  const sortRules = useUIStore((state) => state.sortRules);
  const sortedData = useUIStore((state) => state.sortedData);

  // Access user account
  const userProfile = useUIStore((state) => state.userProfile);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 200);

  // Setter (unified setter from the store)
  const set = useUIStore((state) => state.set);

  // ========================================================================================
  // Color Helper
  // ========================================================================================
  
  const stringToColor = useCallback((str: string, lightness: number): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, ${lightness}%)`;
  }, []);

  const isDarkColor = useCallback((hsl?: string): boolean => {
    if (typeof hsl !== "string") return false;

    const parts = hsl.split(",");
    if (parts.length < 3) return false;

    const lightnessStr = parts[2]?.replace("%", "").replace(")", "").trim();
    const lightness = lightnessStr ? parseInt(lightnessStr, 10) : NaN;

    return !isNaN(lightness) && lightness < 50;
  }, []);

  const lighterColor = useMemo(() => stringToColor(baseId ?? '', 90), [stringToColor, baseId]);

  const isColumnSorted = useCallback((columnId: string): boolean => {
    return sortRules.some(rule => rule.columnId === columnId);
  }, [sortRules]);

  // ========================================================================================
  // API QUERIES
  // ========================================================================================
  
  const { data: baseData, isLoading: isBaseLoading, error: baseError } =
    api.base.getBase.useQuery({ baseId: baseId ?? '' }, { enabled: !!baseId });

  const { 
    data: infiniteTableData, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    isLoading: isTableLoading,
  } = api.table.getTableById.useInfiniteQuery(
    { 
      baseId: baseId ?? '',
      tableId: activeTableId ?? '', 
      limit: 200,
    },
    {
      getNextPageParam: (lastPage) => { 
        return lastPage.hasNextPage ? lastPage.nextCursor : undefined;
      },
      enabled: !!(baseId && activeTableId),
      staleTime: 5 * 60 * 1000,
      retry: 3,
    }
  );

  const tableData = useMemo(() => {
    if (!infiniteTableData?.pages?.length) return null;
    
    const firstPage = infiniteTableData.pages[0];
    if (!firstPage) return null;
    
    // Flatten all rows from all pages
    const allRows = infiniteTableData.pages.flatMap(page => page.rows);
    
    return {
      id: firstPage.id,
      name: firstPage.name,
      columns: firstPage.columns,
      rows: allRows
    };
  }, [infiniteTableData]);

  const { data: baseName, isLoading } = api.base.getBaseName.useQuery({
    baseId: baseId ?? '',
  }, { enabled: !!baseId });

  // ========================================================================================
  // API MUTATIONS
  // ========================================================================================
  
  const addTable = api.table.addTable.useMutation({
    onSuccess: (newTable) => {
      utils.base.getBase.setData({ baseId: baseId ?? '' }, (old) => {
        if (!old) return old;
        return {
          ...old,
          tables: [...old.tables, newTable]
        };
      });
      
      void utils.base.getBase.invalidate({ baseId: baseId ?? '' });
    },
    onError: (error) => {
      console.error("Add table error:", error);
    }
  });

  const updateColumnVisibility = api.table.updateColumnVisibility.useMutation({
    onError: (e) => console.error("Update column visibility error:", e),
    onSuccess: () => void utils.table.getTableById.invalidate()
  });

  const removeTable = api.table.deleteTable.useMutation({
    onError: (e) => console.error("Delete table error:", e),
    onSuccess: () => {
      void utils.base.getBase.invalidate({ baseId: baseId ?? '' });
    },
  });

  const createColumn = api.column.addColumn.useMutation({
    onSuccess: (newColumn) => { 
      if (activeTableId && baseId) {
        utils.table.getTableById.setData({ baseId, tableId: activeTableId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            columns: [...old.columns, newColumn].sort((a, b) => a.order - b.order)
          };
        });
      }
      
      void utils.table.getTableById.invalidate({ baseId: baseId ?? '', tableId: activeTableId ?? '' });
    },
    onError: (error) => {
      console.error("Add column error:", error);
    }
  });

  const removeColumn = api.column.deleteColumn.useMutation({
    onError: (e) => console.error("Delete column error:", e),
    onSuccess: () => {
      void utils.table.getTableById.invalidate({ baseId: baseId ?? '' });
    }
  });

  const createRow = api.row.addRow.useMutation({
    onSuccess: (newRow) => {
      toast.success("Row added successfully!", {});
      void utils.table.getTableById.invalidate({ baseId: baseId ?? '' });

      if (activeTableId && baseId) {
        utils.table.getTableById.setData({ baseId, tableId: activeTableId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            rows: [...old.rows, newRow]
          };
        });
      }
    },
    onError: (error) => {
      toast.error("Failed to add row. Please try again.");
      console.error("Add row error:", error);
    }
  });

  const deleteRow = api.row.deleteRow.useMutation({
    onError: (e) => console.error("Delete row error:", e),
    onSuccess: ({ rowId }) => {
      if (!activeTableId || !baseId) return;
      utils.table.getTableById.setData({ baseId, tableId: activeTableId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.filter((r) => r.id !== rowId),
        };
      });
    },
  });

  const renameColumn = api.column.renameColumn.useMutation({
    onError: (e) => console.error("Rename column error:", e),
    onSuccess: ({ columnId, newName }) => {
      if (!activeTableId || !baseId) return;
      utils.table.getTableById.setData({ baseId, tableId: activeTableId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((col) =>
            col.id === columnId ? { ...col, name: newName } : col
          ),
        };
      });
    },
  });

  const sortRecordsMutation = api.sort.getSortedRecords.useMutation({
    onSuccess: (data: BackendRow[]) => {
      console.log("Sorted rows returned:", data);
      set({ sortedData: data });
    },
    onError: (err) => {
      console.error("Sort error:", err);
      set({ sortedData: null });
    },
  });

  const createManyRows = api.row.createManyRowsBatch.useMutation({
    onSuccess: async () => {
      await utils.table.getTableRows.invalidate({ tableId: activeTableId ?? '' });
      if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    },
    onError: (error) => {
      console.error("Bulk row creation error:", error);
    },
  });

  // ========================================================================================
  // COMPUTED VALUES - Move before useEffect hooks
  // ========================================================================================
  
  // Table columns definition
  const memorizedColumns = useMemo(() => {
    if (!tableData || !activeTableId) return [];

    return tableData.columns
      .filter(col => columnVisibility[col.id] !== false)
      .map((col) => ({
        accessorKey: col.id,
        header: col.name,
        cell: (props: CellContext<FlattenedRow, unknown>) => (
          <EditableCell
          initialValue={(() => {
            const value = props.getValue();
            if (value == null) return "";
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return "";
          })()}
          tableId={activeTableId}
          rowId={props.row.id}
          columnId={props.column.id}
          searchTerm={debouncedSearchTerm}
        />
        ),
      }));
  }, [tableData, activeTableId, debouncedSearchTerm, columnVisibility]);

  // different combinations of filtering and sorting
  const finalRows = useMemo<BackendRow[]>(() => {
    if (!filteredData && !sortedData) return tableData?.rows ?? [];
    if (filteredData && !sortedData) return filteredData;
    if (!filteredData && sortedData) return sortedData;
    if (!filteredData || !sortedData) return [];

    const filteredIds = new Set(filteredData.map(row => row.id));
    return sortedData.filter(row => filteredIds.has(row.id));
  }, [filteredData, sortedData, tableData?.rows]);

  const memorizedTransformedRows = useMemo<FlattenedRow[]>(() => {
    return finalRows.map((row: BackendRow) => {
      const values: FlattenedRow = { id: row.id };
      if (Array.isArray(row.cells)) {
        for (const cell of row.cells) {
          if (cell.columnId && cell.columnId !== null) {
            values[String(cell.columnId)] = cell.value ?? '';
          }
        }
      }
      return values;
    });
  }, [finalRows]);

  // Search results calculation
  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm.trim() || !tableData) {
      return { totalMatches: 0 };
    }

    let totalMatches = 0;
    const searchLower = debouncedSearchTerm.toLowerCase();

    // Count matches in column headers
    tableData.columns.forEach(column => {
      if (column.name.toLowerCase().includes(searchLower)) {
        totalMatches++;
      }
    });

    // Count matches in all cells
    tableData.rows.forEach(row => {
      row.cells.forEach(cell => {
        const cellValue = String(cell.value ?? '').toLowerCase();
        if (cellValue.includes(searchLower)) {
          totalMatches++;
        }
      });
    });

    return { totalMatches };
  }, [debouncedSearchTerm, tableData]);

  // Initialize TanStack table
  const table = useReactTable<FlattenedRow>({
    data: memorizedTransformedRows,
    columns: memorizedColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  const rowVirtualizer = useVirtualizer({
    count: memorizedTransformedRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  // ========================================================================================
  // EFFECTS
  // ========================================================================================
  
  // Authentication check
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      void router.push("/");
    }
  }, [isLoaded, isSignedIn, router]);

  // Set initial active table when base data loads
  useEffect(() => {
    if (baseData?.tables?.[0] && !activeTableId) {
      set({ activeTableId: baseData.tables[0].id });
    }
  }, [baseData, activeTableId, set]);

  // Initialize column visibility when table data loads
  useEffect(() => {
    if (!tableData) return;

    const visibilityState = tableData.columns.reduce((acc, col) => {
      acc[col.id] = col.visible;
      return acc;
    }, {} as Record<string, boolean>);
    
    set({ columnVisibility: visibilityState });
  }, [tableData, set]);

  // Reset filtered data when table data loads
  useEffect(() => {
    if (tableData) {
      set({ filteredData: null });
    }
  }, [tableData, set]);

  // Reset sorted data when active table changes
  useEffect(() => {
    set({ sortedData: null });
  }, [activeTableId, set]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        set({ selectedRows: new Set()});
        set({ allSelected: false});
        if (!isColumnOperationRef.current) {
          set({selectedColIndex: null});
          set({columnContextMenu: null});
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [set]);

  useEffect(() => { 
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      toast.error('An unexpected error occurred. Please refresh the page.');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Add this useEffect to handle infinite scrolling
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    const [lastItem] = virtualItems.slice(-1);
    
    if (!lastItem) return;
    
    const totalRows = memorizedTransformedRows.length;
    const currentPosition = lastItem.index;
    const progressPercentage = (currentPosition / totalRows) * 100;
    
    // Prefetch when user is 30% through the current data
    if (progressPercentage > 30 && hasNextPage && !isFetchingNextPage) {
      console.log('Prefetching next page at 30% progress');
      void fetchNextPage();
    }
  }, [
    rowVirtualizer,
    memorizedTransformedRows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  ]);

  // ========================================================================================
  // EVENT HANDLERS
  // ========================================================================================
  
  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    toast.dismiss();
  }, []);

  const handleAddTable = useCallback(async () => {
    if (!baseId) {
      toast.error("Base ID not found");
      return;
    }
    
    if (addTable.isPending) {
      toast.warn("Table is already being created...");
      return;
    }
    
    try {
      await addTable.mutateAsync({ baseId });
    } catch (error) {
      console.error("Table creation failed:", error);
    }
  }, [baseId, addTable]);

  const handleDeleteTable = useCallback(async (tableIdToDelete: string) => {
    if (!baseId || !activeTableId) return;

    try {
      await removeTable.mutateAsync({ tableId: tableIdToDelete });
      await utils.base.getBase.invalidate({ baseId });
      const updatedBase = await utils.base.getBase.fetch({ baseId });

      if (updatedBase?.tables.length > 0) {
        const fallbackTable =
          updatedBase.tables.find((t) => t.id !== tableIdToDelete) ?? updatedBase.tables[0];

        set({ activeTableId: fallbackTable?.id ?? null });
      } else {
        set({ activeTableId: null });
      }
    } catch (err) {
      if (!isCancelledError(err)) {
        console.error("Failed to delete table:", err);
      }
    }
  }, [baseId, activeTableId, removeTable, utils.base.getBase, set]);

  const handleAddColumn = useCallback(async () => {
    if (!baseId || !activeTableId) {
      toast.error("Missing required information");
      return;
    }
    
    if (!newColumnName.trim()) {
      toast.error("Column name is required");
      return;
    }
    
    if (createColumn.isPending) {
      toast.warn("Column is already being created...");
      return;
    }
    
    try {
      await createColumn.mutateAsync({ 
        tableId: activeTableId, 
        name: newColumnName.trim(), 
        type: newColumnType 
      });
      
      set({ 
        isAddingColumn: false,
        newColumnName: "",
        newColumnType: "text"
      });
    } catch (error) {
      console.error("Column creation failed:", error);
    }
  }, [baseId, activeTableId, newColumnName, newColumnType, createColumn, set]);

  const handleDeleteColumn = useCallback(async (columnId: string) => {
    if (!baseId || !activeTableId) return;
    
    isColumnOperationRef.current = true;
    
    try {
      await removeColumn.mutateAsync({ columnId });
      set({selectedColIndex: null});
      set({columnContextMenu: null});
    } finally {
      setTimeout(() => {
        isColumnOperationRef.current = false;
      }, 100);
    }
  }, [baseId, activeTableId, removeColumn, set]);

  const handleAddRow = useCallback(async () => {
    if (!baseId || !activeTableId) {
      toast.error("Missing required information");
      return;
    }
    
    if (createRow.isPending) {
      toast.warn("Row is already being created...");
      return;
    }
    
    try {
      await createRow.mutateAsync({ tableId: activeTableId });
    } catch (error) {
      console.error("Row creation failed:", error);
    }
  }, [baseId, activeTableId, createRow]);

  const handleDeleteRow = useCallback(async (rowId: string) => {
    if (!baseId || !activeTableId) return;
    deleteRow.mutate({ rowId: rowId });
  }, [baseId, activeTableId, deleteRow]);

  const handleRenameColumn = useCallback(async (columnId: string, newName: string) => {
    if (!baseId || !activeTableId) return;
    
    isColumnOperationRef.current = true;
    
    try {
      await renameColumn.mutateAsync({ columnId: columnId, newName: newName });
    } finally {
      setTimeout(() => {
        isColumnOperationRef.current = false;
      }, 500);
    }
  }, [baseId, activeTableId, renameColumn]);

  const handleApplySort = useCallback((rules: { columnId: string; direction: string }[]) => {
    if (!tableData) return;
    
    const finalRules = rules.length === 0
      ? [{ columnId: "createdAt", direction: "asc" as SortDirection }]
      : rules.map((r) => ({
          columnId: r.columnId,
          direction: (r.direction === "desc" ? "desc" : "asc") as SortDirection,
        }));

    sortRecordsMutation.mutate({
      tableId: tableData.id,
      sortBy: finalRules,
    });
  }, [tableData, sortRecordsMutation]);

  const handleToggleColumnVisibility = useCallback(async (columnId: string) => {
    const newVisibility = !columnVisibility[columnId];
    const currentVisibility = useUIStore.getState().columnVisibility;
    set({
      columnVisibility: {
        ...currentVisibility,
        [columnId]: newVisibility,
      },
    });

    updateColumnVisibility.mutate({
      columnId,
      visible: newVisibility,
    });
  }, [columnVisibility, set, updateColumnVisibility]);

  const handleFilteredDataChange = useCallback((data: BackendRow[] | null) => {
    set({filteredData: data});
  }, [set]);

  const toggleUserMenu = useCallback(() => set({userProfile: !userProfile}), [set, userProfile]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Early return after all hooks
  if (!isLoaded) return null;

  if (!isLoaded || !isSignedIn) return null;

  // ========================================================================================
  // LOADING & ERROR STATES
  // ========================================================================================
  
  if (isBaseLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 text-sm font-medium">
        Loading base
        <span className="ml-1 flex space-x-1">
          <span className="animate-bounce [animation-delay:0s]">.</span>
          <span className="animate-bounce [animation-delay:0.15s]">.</span>
          <span className="animate-bounce [animation-delay:0.3s]">.</span>
        </span>
      </div>
    );
  }

  if (baseError || !baseData) {
    toast.error("Base not found or failed to load.", { toastId: "base-error" });
    return (
      <div className="h-screen flex items-center justify-center text-red-500 text-sm">
        Error: Base not found.
      </div>
    );
  }

  if (!baseData.tables.length) {
    toast.warn("No tables found in this base.", { toastId: "no-table" });
  }

  // ========================================================================================
  // RENDER
  // ========================================================================================
  
  return (
    <div className="h-screen flex">
      {/* OUTERMOST Sidebar - App Navigation */}
      <div
        className="w-14 bg-white border-r border-gray-200 flex flex-col justify-between items-center py-4"
      >
        <div
          className="w-7 h-7 cursor-pointer"
          onMouseEnter={() => set({hovered: true})}
          onMouseLeave={() => set({hovered: false})}
          onClick={() => void router.push("/")}
        >
          {hovered ? (
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          ) : (
            <Image
              src="/airtable.png"
              alt="Logo"
              width={90}
              height={30}
              className="w-6 h-6 object-contain"
            />
          )}
        </div>

        {/* Bottom: K Profile */}
        <div className="absolute bottom-4 left-4 flex flex-col items-center space-y-6 z-50">
          {/* Top icons */}
          <Info className="w-4 h-4 text-gray-600 hover:text-black cursor-pointer" />
          <Bell className="w-4 h-4 text-gray-600 hover:text-black cursor-pointer" />

          {/* Profile button */}
          <button onClick={toggleUserMenu}>
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="User"
                className="rounded-full"
                width={26}
                height={26}
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full text-sm font-bold cursor-pointer">
                {user?.firstName?.[0] ?? "U"}
              </div>
            )}
          </button>

          {/* Side dropdown menu */}
          {userProfile && (
            <div className="absolute left-12 bottom-0 w-64 bg-white shadow-xl border border-gray-200 rounded-md font-sans text-sm text-gray-800 z-50">
              <div className="px-4 py-3 border-b">
                <p className="font-semibold">{user?.fullName}</p>
                <p className="text-xs text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>

              <ul className="py-2">
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Account</li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between">
                  <span>Manage groups</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Business</span>
                </li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Notification preferences</li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Language preferences</li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between">
                  <span>Appearance</span>
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Beta</span>
                </li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Integrations</li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Builder hub</li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-500">Trash</li>
              </ul>

              <div className="border-t px-4 py-2">
                <SignOutButton>
                  <button className="w-full text-left hover:bg-gray-100 px-2 py-1 rounded-md text-red-600">
                    Log out
                  </button>
                </SignOutButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - spans full width of main content */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        {/* Left: Logo + Base name dropdown */}
        <div className="flex items-center gap-2 min-w-[220px]">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: stringToColor(baseId ?? '', 50) }}
          >
            <Image
              src="/airtable.png"
              alt="Logo"
              width={28}
              height={28}
              className={`object-contain ${isDarkColor(stringToColor(baseId ?? '', 50)) ? "invert" : ""}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <div className="text-[18px] font-semibold text-gray-800 whitespace-nowrap">
              {isLoading ? "Loading..." : baseName ?? "Untitled Base"}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-800" />
          </div>
        </div>

        {/* Center: Navigation links */}
        <nav className="flex items-center gap-3 text-sm text-gray-600">
          <a
            href="#"
            className="relative font-medium text-black px-2"
          >
            <span className="relative z-10">Data</span>
            <span
              className="absolute top-9 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-sm"
              style={{ backgroundColor: stringToColor(baseId ?? "", 50) }}
            />
          </a>
          <a href="#" className="hover:text-black">Automations</a>
          <a href="#" className="hover:text-black">Interfaces</a>
          <a href="#" className="hover:text-black">Forms</a>
        </nav>

        {/* Right: Controls */}
        <div className="flex items-center gap-3 text-xs whitespace-nowrap">
          <History className="w-4 h-4 text-gray-700"/>
          <span className="bg-[#f2f2f2] text-[13px] text-gray-800 px-3 py-2 rounded-full">
            Trial: 7 days left
          </span>
          <button className="text-white text-xs px-3 py-1.5 shadow-sm rounded-md font-medium cursor-pointer"
          style={{ backgroundColor: stringToColor(baseId ?? '', 50) }}>
            Share
          </button>
        </div>
      </header>

        {/* Table Tabs Section */}
        <div
          className="flex items-center border-gray-200 text-sm relative"
          style={{ backgroundColor: lighterColor }}
        >
          {baseData.tables.map((table) => (
            <div key={table.id} className="relative border-r border-gray-200">
              <div
                className={`flex items-center px-4 py-1 rounded-t-md border border-gray-200 cursor-pointer ${
                  table.id === activeTableId
                    ? "bg-white text-black border-b-white font-semibold"
                    : "text-gray-500 hover:text-black border-transparent"
                }`}
              >
                
                <button onClick={() => set({ activeTableId: table.id })} className="mr-1">
                  {table.name}
                </button>
                <ChevronDown
                  size={16}
                  className="text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentOpenDropdownId = useUIStore.getState().openDropdownId;
                    set({
                      openDropdownId: currentOpenDropdownId === table.id ? null : table.id,
                    });
                  }}
                />
              </div>

              {/* Dropdown menu */}
              {openDropdownId === table.id && (
                <div
                  className="absolute z-50 top-full mt-1 left-0 w-56 bg-white border border-gray-200 shadow-lg rounded-md p-1"
                >
                  <ul className="text-sm text-gray-700">
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Import data</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Rename table</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Hide table</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Manage fields</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Duplicate table</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Configure date dependencies</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Edit table description</li>
                    <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Edit table permissions</li>
                    <li
                      className="px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer"
                      onClick={() => {
                        if (removeTable.isPending) {
                          toast.warn("Table deletion already in progress");
                          return;
                        }
                        void handleDeleteTable(table.id);
                      }}
                    >
                      Delete table
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={handleAddTable}
            disabled={addTable.isPending}
            className={`flex items-center ml-2 px-2 py-1 text-[14px] cursor-pointer transition-colors ${
              addTable.isPending 
                ? "text-gray-400 cursor-not-allowed" 
                : "text-gray-600 hover:text-gray-700"
            }`}
          >
            {addTable.isPending ? (
              <>
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
                Creating...
              </>
            ) : (
              "+ Add or Import"
            )}
          </button>
        </div>

        <TableToolbar   
          onSearchChange={handleSearchChange} 
          searchResult={searchResults}
          onToggleColumnVisibility={handleToggleColumnVisibility}
          columns={tableData?.columns ?? []}
          columnVisibility={columnVisibility}
          tableId={tableData?.id ?? ""}
          onFilteredDataChange={handleFilteredDataChange}
          sortRules={sortRules}
          setSortRules={(rules) => set({ sortRules: rules })}
          onApplySort={handleApplySort}
          onDataRefresh={async () => {
            if (tableContainerRef.current) {
              tableContainerRef.current.scrollTop = 0;
            }
            
            set({ 
              filteredData: null,
              sortedData: null,
              selectedRows: new Set(),
              allSelected: false
            });
            
            await utils.table.getTableById.invalidate({ baseId: baseId ?? '', tableId: activeTableId ?? '' });
            await utils.table.getTableById.refetch({ baseId: baseId ?? '', tableId: activeTableId ?? '' });
            
            setTimeout(() => {
              rowVirtualizer.scrollToIndex(0);
            }, 100);
          }}
        />

        {/* Main Content with Sidebar and Table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT Sidebar with View Controls */}
          <aside className="w-70 bg-white border-r border-gray-200 p-3 flex flex-col gap-3 text-sm text-[13px]">
            <div className="px-3 py-2 rounded flex items-center gap-2 ">
              <Plus className="w-4 h-4 text-gray-700"/>
              <span className="text-gray-900">Create new...</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <Search className="w-4 h-4 text-gray-400"/>
              <span className="text-gray-500">Find a view</span>
              <Settings className="w-4 h-4 ml-28 text-gray-600"/>
            </div>
            <div className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 text-[#1778f7] font-medium">
              <Table className="w-4 h-4"/>
              <span className="text-gray-500">Grid View</span>
            </div>
          </aside>

          {/* Table Content */}
          <main ref={tableRef} className="flex-1 overflow-auto bg-gray-50">
            {isTableLoading ? (
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <p className="text-gray-500 text-sm flex items-center">
                  Loading table
                  <span className="ml-1 flex space-x-1">
                    <span className="animate-bounce [animation-delay:0s]">.</span>
                    <span className="animate-bounce [animation-delay:0.15s]">.</span>
                    <span className="animate-bounce [animation-delay:0.3s]">.</span>
                  </span>
                </p>
              </div>
            ) : tableData ? (
              <div className="flex flex-col h-full">
                {/* Single table with virtualized body */}
                <div
                  ref={tableContainerRef}
                  className="flex-1 bg-white"
                >
                  <table className="min-w-full border border-gray-300 bg-white table-fixed">
                    {/* Fixed Header */}
                    <thead className="bg-white sticky top-0 z-10">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header, index) => (
                            <th
                              key={header.id}
                              onContextMenu={() => {
                                set({selectedColIndex: index});
                                set({activeCell: { row: 0, col: index }});
                                set({editColumnName: header.column.columnDef.header as string})
                              }}
                              className={`relative group border-b border-r border-gray-300 px-2 py-1 text-sm text-gray-800 text-left hover:bg-gray-100 font-semibold ${
                                selectedColIndex === index ? "bg-blue-50" : ""
                              } ${
                                isColumnSorted(header.column.id) ? "bg-[#ffe0cc]" : ""
                              }`}
                              style={{ width: index === 0 ? '200px' : '150px' }}
                            >
                              {index === 0 ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const allIds = table.getRowModel().rows.map((r) => r.id);
                                      const newSelected = new Set(allSelected ? [] : allIds);
                                      set({selectedRows: newSelected});
                                      set({allSelected: !allSelected});
                                    }}
                                  >
                                    {allSelected ? <CheckSquare className="w-4 h-4 text-gray-700" /> : <Square className="w-4 h-4 text-gray-700" />}
                                  </button>
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchTerm(
                                        flexRender(header.column.columnDef.header, header.getContext()) as string,
                                        debouncedSearchTerm
                                      )
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchTerm(
                                        flexRender(header.column.columnDef.header, header.getContext()) as string,
                                        debouncedSearchTerm
                                      )
                                    }}
                                  />
                                  {selectedColIndex === index && (
                                    <div className="absolute top-full mt-1 right-0 z-20 w-44 bg-white border rounded shadow text-sm p-2">
                                      <div className="mb-2">
                                        <label className="block text-gray-600 mb-1">Rename column</label>
                                        <input
                                          type="text"
                                          value={editColumnName}
                                          onChange={(e) => set({editColumnName: e.target.value})}
                                          className="w-full border px-2 py-1 rounded text-sm"
                                          placeholder="New name"
                                        />
                                        <div className="flex justify-end gap-2 mt-1">
                                          <button
                                            className="text-blue-600 hover:underline text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRenameColumn(header.column.id, editColumnName);
                                              set({selectedColIndex: null});
                                            }}
                                          >
                                            Save
                                          </button>
                                          <button
                                            className="text-gray-500 hover:underline text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              set({selectedColIndex: null});
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                      <hr className="my-2" />
                                      <button
                                        className="text-red-500 hover:underline text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const confirmDelete = confirm("Are you sure you want to delete this column?");
                                          if (confirmDelete) {
                                            void handleDeleteColumn(header.column.id);
                                            set({selectedColIndex: null});
                                          }
                                        }}
                                      >
                                        Delete column
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </th>
                          ))}
                          {/* "+" Button column ONLY in header */}
                          <th className="border-b border-gray-300 px-2 py-1 text-sm text-blue-500 text-left relative" style={{ width: '60px' }}>
                            {isAddingColumn ? (
                              <div className="absolute z-20 bg-white shadow-md border rounded p-2 w-48 right-0 top-full mt-1">
                                <input
                                  type="text"
                                  className="w-full border px-2 py-1 mb-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Column name"
                                  value={newColumnName}
                                  onChange={(e) => set({newColumnName: e.target.value})}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newColumnName.trim()) {
                                      void handleAddColumn();
                                    }
                                    if (e.key === 'Escape') {
                                      set({isAddingColumn: false});
                                    }
                                  }}
                                  autoFocus
                                />
                                <select
                                  className="w-full border px-2 py-1 mb-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={newColumnType}
                                  onChange={(e) => set({newColumnType: e.target.value})}
                                >
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                </select>
                                <div className="flex justify-between gap-2">
                                  <button
                                    onClick={handleAddColumn}
                                    disabled={createColumn.isPending || !newColumnName.trim()}
                                    className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                                      createColumn.isPending || !newColumnName.trim()
                                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                    }`}
                                  >
                                    {createColumn.isPending ? (
                                      <div className="flex items-center justify-center">
                                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                                        Adding...
                                      </div>
                                    ) : (
                                      "Add"
                                    )}
                                  </button>
                                  <button
                                    onClick={() => set({
                                      isAddingColumn: false,
                                      newColumnName: "",
                                      newColumnType: "text"
                                    })}
                                    disabled={createColumn.isPending}
                                    className="flex-1 bg-gray-200 text-black px-2 py-1 text-xs rounded hover:bg-gray-300 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => set({ isAddingColumn: true })}
                                className="flex items-center justify-center p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Add new column"
                              >
                                <Plus className="w-4 h-4 text-gray-700" />
                              </button>
                            )}
                          </th>
                        </tr>
                      ))}
                    </thead>

                    {/* Virtualized Body */}
                    <tbody>
                      <tr>
                        <td colSpan={memorizedColumns.length + 1} className="p-0">
                          <div
                            style={{
                              height: `${rowVirtualizer.getTotalSize()}px`,
                              width: '100%',
                              position: 'relative',
                            }}
                          >
                            {virtualItems.map((virtualRow) => {
                              const row = table.getRowModel().rows[virtualRow.index];
                              if (!row) return null;
                              
                              return (
                                <div
                                  key={row.id}
                                  className="absolute inset-x-0 hover:bg-gray-100"
                                  style={{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: 'table',
                                    width: '100%',
                                    tableLayout: 'fixed',
                                  }}
                                >
                                  <div style={{ display: 'table-row' }}>
                                    {row.getVisibleCells().map((cell, index) => (
                                      <div
                                        key={cell.id}
                                        data-row={virtualRow.index}
                                        data-col={index}
                                        onContextMenu={(e) => {
                                          if (index === 0) {
                                            e.preventDefault();
                                            set({contextRow: row.id})
                                          }
                                        }}
                                        className={`relative border-t border-r border-gray-200 px-2 py-1 text-sm ${
                                          selectedColIndex === index || selectedRows.has(row.id)
                                            ? "bg-gray-100"
                                            : ""
                                        } ${
                                          isColumnSorted(cell.column.id) ? "bg-[#ffe0cc]" : ""
                                        }`}

                                        style={{ 
                                          display: 'table-cell',
                                          width: index === 0 ? '200px' : '150px',
                                          verticalAlign: 'middle'
                                        }}
                                      >
                                        {index === 0 ? (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            {/* Checkbox */}
                                            <button
                                              onClick={() => {
                                                const newSet = new Set(selectedRows);
                                                if (newSet.has(row.id)) {
                                                  newSet.delete(row.id);
                                                } else {
                                                  newSet.add(row.id);
                                                }
                                                set({selectedRows: newSet});
                                                set({allSelected: newSet.size === table.getRowModel().rows.length});
                                              }}
                                            >
                                              {selectedRows.has(row.id) ? (
                                                <CheckSquare className="w-4 h-4 text-gray-700" />
                                              ) : (
                                                <Square className="w-4 h-4 text-gray-700" />
                                              )}
                                            </button>

                                            {/* Row index */}
                                            <span className="min-w-[30px] w-5 text-right text-gray-500 whitespace-nowrap">
                                              {row.index + 1}
                                            </span>

                                            <div className="flex-1 whitespace-nowrap">
                                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                          </div>
                                        ) : (
                                          flexRender(cell.column.columnDef.cell, cell.getContext())
                                        )}

                                        {/* normal table data context menu */}
                                        {contextRow === row.id && index === 0 && (
                                          <div
                                            className="absolute z-20 bottom-full left-0 mb-1 bg-white border rounded shadow-md text-sm px-2 py-1 min-w-[160px] max-w-[220px] w-fit"
                                          >
                                            <button
                                              className="text-red-500 hover:underline text-xs w-full text-left"
                                              onClick={() => {
                                                const confirmDelete = confirm("Are you sure you want to delete this row?");
                                                if (confirmDelete) {
                                                  void handleDeleteRow(row.id);
                                                  set({contextRow: null});
                                                }
                                              }}
                                            >
                                              Delete row
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {/* Empty cell for the "+" column */}
                                    <div 
                                      className="border-t border-gray-200 px-2 py-1 text-sm"
                                      style={{ 
                                        display: 'table-cell',
                                        width: '60px'
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {createManyRows.isPending && (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                  
                  {/* Add Row Button - positioned at the bottom, only show when no filter is applied */}
                  {filteredData === null && (
                    <div 
                      onClick={handleAddRow}
                      className={`px-2 py-2 text-sm border-r border-l border-b border-gray-200 flex items-center gap-2 transition-colors ${
                        createRow.isPending 
                          ? "text-gray-400 bg-gray-50 cursor-not-allowed" 
                          : "text-gray-500 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      {createRow.isPending ? (
                        <>
                          <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Adding row...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add row
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No table selected.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}