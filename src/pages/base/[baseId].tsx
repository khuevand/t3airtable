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
import {
  CheckSquare,
  Square,
  Search,
  Settings,
  Table,
  ArrowLeft,
  Info,
  Bell,
  Plus,
} from "lucide-react";
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
import EditableCell from "~/components/editableCells";
import HeaderLayout from "~/components/headerLayout";
import TableTabs from "~/components/tableTabs";
import { useCreateManyRows } from "~/hooks/create15KRows";
import { useTableOperations } from "~/hooks/tableToolBarOperation";

// ========================================================================================
// TYPE DEFINITIONS
// ========================================================================================

interface Table {
  id: string;
  name: string;
}

interface TempColumn {
  id: string;
  name: string;
  type: string;
  order: number;
  tableId: string;
  visible: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type SortDirection = "asc" | "desc";

// ========================================================================================
// MAIN COMPONENT
// ========================================================================================

export default function BasePage() {
  // ========================================================================================
  // HOOKS & REFS
  // ========================================================================================
  
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { isLoaded, isSignedIn } = useUser();

  const baseId = params?.baseId as string;

  const tableRef = useRef<HTMLDivElement>(null);
  const isColumnOperationRef = useRef(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const utils = api.useUtils();

  // ========================================================================================
  // STATE MANAGEMENT
  // ========================================================================================
  
  // Side bar
  const hovered = useUIStore((state) => state.hovered);

  // Table
  const activeTableId = useUIStore((state) => state.activeTableId);
  const openDropdownId = useUIStore((state) => state.openDropdownId);

  // Selection
  const selectedRows = useUIStore((state) => state.selectedRows);
  const selectedColIndex = useUIStore((state) => state.selectedColIndex);
  const allSelected = useUIStore((state) => state.allSelected);

  // Column operations
  const isAddingColumn = useUIStore((state) => state.isAddingColumn);
  const newColumnName = useUIStore((state) => state.newColumnName);
  const newColumnType = useUIStore((state) => state.newColumnType);
  const editColumnName = useUIStore((state) => state.editColumnName);
  const contextRow = useUIStore((state) => state.contextRow);

  // Filter & sort 
  const filteredData = useUIStore(s => s.filteredData);
  const sortRules = useUIStore((state) => state.sortRules);
  const sortedData   = useUIStore(s => s.sortedData);

  const columnVisibility = useUIStore(s => s.columnVisibility ?? {});

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 200);

  // Access user account
  const userProfile = useUIStore((state) => state.userProfile);

  // Setter
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


  const sortedColumnIds = useMemo(() => {
    return new Set((sortRules ?? []).map(r => r.columnId).filter(Boolean));
  }, [sortRules]);

  // ========================================================================================
  // OPTIMISTIC MUTATION HELPER
  // ========================================================================================
  
  function editInfiniteTable(
    key: { baseId: string; tableId: string; limit?: number },
    editor: (draft: NonNullable<ReturnType<typeof utils.table.getTableById.getInfiniteData>>) => void
  ) {
    utils.table.getTableById.setInfiniteData(key, (old) => {
      if (!old) return old;
      // Shallow copy: new wrapper object + new pages array
      const copy = {
        ...old,
        pages: old.pages.map((p) => ({ ...p }))
      };
      editor(copy);
      return copy;
    });
  }

  const forEachPage = <T,>(pages: Array<any>, fn: (p: any) => void) => {
    for (const p of pages) fn(p);
  };

  const currentTable = useMemo(() => {
    const fromBase = baseData?.tables.find(t => t.id === activeTableId);
    if (fromBase) return fromBase;

    if (tableData) return { id: tableData.id, name: tableData.name };

    return null;
  }, [baseData?.tables, activeTableId, tableData?.id, tableData?.name]);

  const currentTableName = currentTable?.name ?? "";

  // ========================================================================================
  // API MUTATIONS
  // ========================================================================================
  
  const addTable = api.table.addTable.useMutation({
    async onMutate({ baseId, currentTableName }) {
      await utils.base.getBase.cancel({ baseId });
      const prev = utils.base.getBase.getData({ baseId });

      const temp = {
        id: `temp-${Date.now()}`,
        name: "Table",
      };

      utils.base.getBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return { ...old, tables: [...old.tables, temp] };
      });

      return { prev, baseId };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.base.getBase.setData({ baseId: ctx.baseId }, ctx.prev);
    },
    onSuccess: (newTable) => {
      utils.base.getBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          tables: old.tables.map((t) => (String(t.id).startsWith("temp-") ? newTable : t)),
        };
      });
    },
    onSettled(_data, _err, { baseId }) {
      void utils.base.getBase.invalidate({ baseId });
    },
  });

  const updateColumnVisibility = api.table.updateColumnVisibility.useMutation({
    async onMutate({ columnId, visible }) {
      if (!activeTableId || !baseId) return;
      
      const key = { baseId, tableId: activeTableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      editInfiniteTable(key, (data) => {
        forEachPage(data.pages, (page) => {
          page.columns = page.columns.map((col: any) =>
            col.id === columnId ? { ...col, visible } : col
          );
        });
      });

      return { prev, key, columnId, visible };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to update column visibility. Please try again.");
      
      // Revert UI state as well
      if (ctx) {
        const currentVisibility = useUIStore.getState().columnVisibility;
        set({
          columnVisibility: {
            ...currentVisibility,
            [ctx.columnId]: !ctx.visible, // Revert to previous state
          },
        });
      }
    },
    onSuccess(_data, _vars, _ctx) {
    },
    onSettled(_d, _e) {
      if (baseId && activeTableId) {
        void utils.table.getTableById.invalidate({ baseId, tableId: activeTableId });
      }
    },
  });

  const removeTable = api.table.deleteTable.useMutation({
    async onMutate({ tableId }) {
      const baseIdSafe = baseId ?? "";
      await utils.base.getBase.cancel({ baseId: baseIdSafe });

      const prev = utils.base.getBase.getData({ baseId: baseIdSafe });
      utils.base.getBase.setData({ baseId: baseIdSafe }, (old) => {
        if (!old) return old;
        const remaining = old.tables.filter((t) => t.id !== tableId);
        const fallback = remaining[0]?.id ?? null;
        set({ activeTableId: fallback }); // instant UI change
        return { ...old, tables: remaining };
      });
      return { prev, baseId: baseIdSafe };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.base.getBase.setData({ baseId: ctx.baseId }, ctx.prev);
    },
    onSettled(_d, _e) {
      // final sync
      if (baseId) void utils.base.getBase.invalidate({ baseId });
    },
  });

  const createColumn = api.column.addColumn.useMutation({
    async onMutate({ tableId, name, type }) {
      const key = { baseId: baseId ?? "", tableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      // Create a temporary column with required properties
      const tempCol: TempColumn = { 
        id: `temp-col-${Date.now()}`, 
        name, 
        type,
        tableId: tableId,
        order: Number.MAX_SAFE_INTEGER, 
        visible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      editInfiniteTable(key, (data) => {
        const first = data.pages[0];
        if (!first) return;
        first.columns.push(tempCol);
      });

      return { prev, key };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to create column. Please try again.");
    },
    onSuccess(newColumn, _vars, ctx) {
      if (!ctx) return;
      editInfiniteTable(ctx.key, (data) => {
        const first = data.pages[0];
        if (!first) return;
        first.columns = first.columns
          .map((c: any) => String(c.id).startsWith("temp-col-") ? newColumn : c)
          .sort((a: any, b: any) => a.order - b.order);
      });
      toast.success("Column created successfully!");
    },
    onSettled(_d, _e, { tableId }) {
      if (baseId) void utils.table.getTableById.invalidate({ baseId, tableId });
    },
  });

  const removeColumn = api.column.deleteColumn.useMutation({
    async onMutate({ columnId }) {
      if (!activeTableId || !baseId) return;
      
      const key = { baseId, tableId: activeTableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      editInfiniteTable(key, (data) => {
        forEachPage(data.pages, (page) => {
          page.columns = page.columns.filter((c: any) => c.id !== columnId);
          page.rows = page.rows.map((r: any) => ({
            ...r,
            cells: r.cells.filter((cell: any) => cell.columnId !== columnId)
          }));
        });
      });

      return { prev, key, columnId };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to delete column. Please try again.");
    },
    onSuccess(_data, _vars, _ctx) {
      toast.success("Column deleted successfully!");
    },
    onSettled(_d, _e, { columnId }) {
      if (baseId && activeTableId) {
        void utils.table.getTableById.invalidate({ baseId, tableId: activeTableId });
      }
    },
  });

  const createRow = api.row.addRow.useMutation({
    async onMutate({ tableId }) {
      const key = { baseId: baseId ?? "", tableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      // Create temporary row with empty cells for all columns
      const tempRow = {
        id: `temp-row-${Date.now()}`,
        cells: tableData?.columns.map(col => ({
          id: `temp-cell-${Date.now()}-${col.id}`,
          columnId: col.id,
          value: col.type === 'number' ? 0 : '',
          rowId: `temp-row-${Date.now()}`,
        })) || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      editInfiniteTable(key, (data) => {
        const lastPage = data.pages[data.pages.length - 1];
        if (!lastPage) return;
        lastPage.rows = [...lastPage.rows, tempRow as any];
      });

      return { prev, key, tempRowId: tempRow.id };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to add row. Please try again.");
    },
    onSuccess(newRow, _vars, ctx) {
      if (!ctx) return;
      editInfiniteTable(ctx.key, (data) => {
        forEachPage(data.pages, (page) => {
          page.rows = page.rows.map((r: any) => 
            r.id === ctx.tempRowId ? newRow : r
          );
        });
      });
      toast.success("Row added successfully!");
    },
    onSettled(_d, _e, { tableId }) {
      if (baseId) void utils.table.getTableById.invalidate({ baseId, tableId });
    },
  });

  const deleteRow = api.row.deleteRow.useMutation({
    async onMutate({ rowId }) {
      if (!activeTableId || !baseId) return;
      
      const key = { baseId, tableId: activeTableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      editInfiniteTable(key, (data) => {
        forEachPage(data.pages, (page) => {
          page.rows = page.rows.filter((r: any) => r.id !== rowId);
        });
      });

      return { prev, key, rowId };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to delete row. Please try again.");
    },
    onSuccess(_data, _vars, _ctx) {
      toast.success("Row deleted successfully!");
    },
    onSettled(_d, _e, { rowId }) {
      if (baseId && activeTableId) {
        void utils.table.getTableById.invalidate({ baseId, tableId: activeTableId });
      }
    },
  });

  const renameColumn = api.column.renameColumn.useMutation({
    async onMutate({ columnId, newName }) {
      if (!activeTableId || !baseId) return;
      
      const key = { baseId, tableId: activeTableId };
      await utils.table.getTableById.cancel(key);
      const prev = utils.table.getTableById.getInfiniteData(key);

      editInfiniteTable(key, (data) => {
        forEachPage(data.pages, (page) => {
          page.columns = page.columns.map((col: any) =>
            col.id === columnId ? { ...col, name: newName } : col
          );
        });
      });

      return { prev, key, columnId, newName };
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) utils.table.getTableById.setInfiniteData(ctx.key, ctx.prev);
      toast.error("Failed to rename column. Please try again.");
    },
    onSuccess(_data, _vars, _ctx) {
      toast.success("Column renamed successfully!");
    },
    onSettled(_d, _e, { columnId }) {
      if (baseId && activeTableId) {
        void utils.table.getTableById.invalidate({ baseId, tableId: activeTableId });
      }
    },
  });

  // const sortRecordsMutation = api.sort.getSortedRecords.useMutation({
  //   onSuccess: (data: BackendRow[]) => {
  //     console.log("Sorted rows returned:", data);
  //     set({ sortedData: data });
  //   },
  //   onError: (err) => {
  //     console.error("Sort error:", err);
  //     set({ sortedData: null });
  //   },
  // });

  // ========================================================================================
  // COMPUTED VALUES
  // ========================================================================================

  // Columns definition
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
          searchTerm={searchTerm}        />
        ),
      }));
  }, [tableData, activeTableId, searchTerm, columnVisibility]);

  // Different combinations of filtering and sorting
  const finalRows = useMemo<BackendRow[]>(() => {
    
    if (filteredData && sortedData) {
    const filteredIds = new Set(filteredData.map(row => row.id));
    return sortedData.filter(row => filteredIds.has(row.id));
  }
    if (filteredData && !sortedData) {
    return filteredData;
  }
  
  if (!filteredData && sortedData) {
    return sortedData;
  }
  
  return tableData?.rows ?? [];
}, [tableData?.rows, filteredData, sortedData]);

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

    tableData.columns.forEach(column => {
      if (column.name.toLowerCase().includes(searchLower)) {
        totalMatches++;
      }
    });

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
    estimateSize: () => 36,
    overscan: 20,
  });

  const { 
    creationProgress: bulkCreationProgress, 
    handleCreateManyRows, 
    isCreating: isBulkCreating 
  } = useCreateManyRows({
    baseId: baseId ?? '',
    tableId: activeTableId ?? '',
    rowVirtualizer,
    onComplete: () => {
      console.log('Bulk row creation completed!');
    }
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

  useEffect(() => {
    set({ 
      filteredData: null,
      sortedData: null 
    });
  }, [activeTableId, set]);

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

  // Infinite scrolling handler
  // useEffect(() => {
  //   if (filteredData || sortedData) return;
      
  //   const virtualItems = rowVirtualizer.getVirtualItems();
  //   const [lastItem] = virtualItems.slice(-1);
    
  //   if (!lastItem) return;
    
  //   const totalRows = memorizedTransformedRows.length;
  //   const currentPosition = lastItem.index;
  //   const progressPercentage = (currentPosition / totalRows) * 100;
    
  //   // Prefetch when user is 30% through the current data
  //   if (progressPercentage > 30 && hasNextPage && !isFetchingNextPage) {
  //     console.log('Prefetching next page at 30% progress');
  //     void fetchNextPage();
  //   }
  // }, [
  //   rowVirtualizer,
  //   memorizedTransformedRows.length,
  //   hasNextPage,
  //   isFetchingNextPage,
  //   fetchNextPage
  // ]);

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    
    if (
      lastItem &&
      lastItem.index >= memorizedTransformedRows.length - 100 &&
      hasNextPage &&
      !isFetchingNextPage &&
      memorizedTransformedRows.length > 0
    ) {
      void fetchNextPage();
    }
  }, [rowVirtualizer.getVirtualItems(), memorizedTransformedRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ========================================================================================
  // EVENT HANDLERS
  // ========================================================================================

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
      await addTable.mutateAsync({ baseId, currentTableName });
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
    try {
      await deleteRow.mutateAsync({ rowId });
    } catch (error) {
      console.error("Delete row failed:", error);
    }
  }, [baseId, activeTableId, deleteRow]);

  const handleRenameColumn = useCallback(async (columnId: string, newName: string) => {
    if (!baseId || !activeTableId) return;
    
    isColumnOperationRef.current = true;
    
    try {
      await renameColumn.mutateAsync({ columnId, newName });
    } catch (error) {
      console.error("Rename column failed:", error);
    } finally {
      setTimeout(() => {
        isColumnOperationRef.current = false;
      }, 500);
    }
  }, [baseId, activeTableId, renameColumn]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    toast.dismiss();
  }, []);

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

  const toggleUserMenu = useCallback(() => set({userProfile: !userProfile}), [set, userProfile]);

  const handleSetActiveTable = useCallback((tableId: string) => {
    set({ activeTableId: tableId });
  }, [set]);

  const handleToggleDropdown = useCallback((tableId: string) => {
    const currentOpenDropdownId = useUIStore.getState().openDropdownId;
    set({
      openDropdownId: currentOpenDropdownId === tableId ? null : tableId,
    });
  }, [set]);

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

        {/* Bottom: User Profile */}
        <div className="absolute bottom-4 left-4 flex flex-col items-center space-y-6 z-50">
          <Info className="w-4 h-4 text-gray-600 hover:text-black cursor-pointer" />
          <Bell className="w-4 h-4 text-gray-600 hover:text-black cursor-pointer" />

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
        <HeaderLayout 
          baseId={baseId}
          baseName={baseName}
          isLoading={isLoading}
          stringToColor={stringToColor}
          isDarkColor={isDarkColor}
        />

        {/* Table Tabs Section */}
        <TableTabs 
          tables={baseData.tables}
          activeTableId={activeTableId}
          lighterColor={lighterColor}
          openDropdownId={openDropdownId}
          removeTableIsPending={removeTable.isPending}
          addTableIsPending={addTable.isPending}
          onSetActiveTable={handleSetActiveTable}
          onToggleDropdown={handleToggleDropdown}
          onDeleteTable={handleDeleteTable}
          onAddTable={handleAddTable}
        />

        <TableToolbar   
          tableId={activeTableId ?? ""}
          baseId={baseId ?? ""}
          onSearchChange={handleSearchChange} 
          searchResult={searchResults}
          onToggleColumnVisibility={handleToggleColumnVisibility}
          columns={tableData?.columns ?? []}
          columnVisibility={columnVisibility}
          onCreateManyRows={handleCreateManyRows}
          isBulkCreating={isBulkCreating}
          bulkCreationProgress={bulkCreationProgress}
        />

        {/* Main Content with Sidebar and Table */}
        <div className="flex flex-1 overflow-hidden">
          {/* left Sidebar*/}
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
              <div className="flex flex-col w-full h-full">
                {/* Single table with virtualized body */}
                <div
                  ref={tableContainerRef}
                  className="flex-1 bg-white h-full overflow-auto"
                >
                  <table className="min-w-full border border-gray-300 bg-white table-fixed">
                    {/* Header */}
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
                                sortedColumnIds.has(header.column.id) ? "bg-[#ffe0cc]" : ""
                              }`}
                              // style={{ width: index === 0 ? '200px' : '150px' }}
                              style={{ 
                                width: `${header.getSize()}px`,
                                minWidth: `${header.getSize()}px`,
                                maxWidth: `${header.getSize()}px`
                              }}
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
                                  <div 
                                    className="text-gray-400 font-normal" 
                                    style={{ width: '30px' }}
                                  ></div>
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchTerm(
                                        flexRender(header.column.columnDef.header, header.getContext()) as string,
                                        searchTerm
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
                                        searchTerm
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
                          {/* + for adding column */}
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
                    <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      <tr>
                        <td colSpan={memorizedColumns.length + 1} className="p-0">
                          <div
                            style={{
                              // height: `${rowVirtualizer.getTotalSize()}px`,
                              width: '100%',
                              position: 'absolute',
                              top: 0,
                              left: 0,
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
                                          sortedColumnIds.has(cell.column.id) ? "bg-[#ffe0cc]" : ""
                                        }`}

                                        style={{ 
                                          display: 'table-cell',
                                          height: '36px',
                                          // width: index === 0 ? '200px' : '150px',
                                          verticalAlign: 'middle',
                                          width: `${cell.column.getSize()}px`,
                                          minWidth: `${cell.column.getSize()}px`,
                                          maxWidth: `${cell.column.getSize()}px`,
                                          overflow: 'hidden', 
                                          textOverflow: 'ellipsis', 
                                          whiteSpace: 'nowrap' 
                                        }}
                                      >
                                        {index === 0 ? (
                                          <div className="flex items-center gap-2 text-gray-700">
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
                                            <span className="min-w-[30px] w-5 text-right text-gray-500 whitespace-nowrap" style={{ width: '30px'}}>
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

                  {isBulkCreating && (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                  
                  {/* Add Row Button */}
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