    import { useRouter } from "next/router";
    import { useEffect, useMemo, useState, useRef } from "react";
    import { SignOutButton, useUser } from "@clerk/nextjs";
    import {
      useReactTable,
      getCoreRowModel,
      flexRender,
    } from "@tanstack/react-table";
    import { createTRPCRouter } from "~/server/api/trpc";
    import type { CellContext, ColumnDef } from "@tanstack/react-table";
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

    // ========================================================================================
    // TYPE DEFINITIONS AND COLOR PICK
    // ========================================================================================

    interface Column {
      id: string;
      name: string;
      type: string;
      order: number;
      visible: boolean;
    }

    interface Row {
      id: string;
      cells: Cell[];
    }

    interface Table {
      id: string;
      name: string;
    }

    interface TableData {
      name: string;
      columns: Column[];
      rows: Row[];
    }

    interface Cell {
      id: string;
      rowId: string;
      columnId: string;
      value: string | null;
    }

    type RowData = Record<string, any>;
    type SortDirection = "asc" | "desc";

    interface EditableCellProps {
      initialValue: string;
      tableId: string;
      rowId: string;
      columnId: string;
      searchTerm?: string;
    }

    type SortRule = {
      columnId: string;
      direction: "asc" | "desc";
    };

    // ========================================================================================
    // EDITABLE CELL COMPONENT
    // ========================================================================================

    const EditableCell: React.FC<EditableCellProps> = ({
      initialValue,
      tableId,
      rowId,
      columnId,
      searchTerm = '',
    }) => {
      // State
      const [value, setValue] = useState(initialValue);
      const [isEditing, setIsEditing] = useState(false);
      
      // Refs
      const inputRef = useRef<HTMLInputElement>(null);
      
      // API
      const utils = api.useUtils();
      const updateCell = api.cell.updateCell.useMutation();

      // Effects
      useEffect(() => {
        if (!isEditing) {
          setValue(initialValue);
        }
      }, [initialValue, isEditing]);

      useEffect(() => {
        if (isEditing && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, [isEditing]);

      // Event handlers
      const handleBlur = () => {
        setTimeout(() => {
          if (isEditing) {
            setIsEditing(false);
            if (value !== initialValue) {
              updateCell.mutate(
                { rowId, columnId, value },
                {
                  onSuccess: () => {
                    utils.table.getTableById.invalidate({ tableId });
                  },
                  onError: (error) => {
                    console.error('Failed to update cell:', error);
                    setValue(initialValue);
                    setIsEditing(true);
                  }
                }
              );
            }
          }
        }, 100);
      };

      const handleFocus = () => {
        setIsEditing(true);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleBlur();
        }
        if (e.key === 'Escape') {
          setValue(initialValue);
          setIsEditing(false);
        }
      };

      const handleDoubleClick = () => {
        setIsEditing(true);
      };

      // Render
      if (isEditing) {
        return (
          <input
            ref={inputRef}
            className="w-full border-none bg-transparent focus:outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        );
      }

      const highlightedText = highlightSearchTerm(value || '', searchTerm);
      
      return (
        <div
          className="w-full cursor-text min-h-[20px] px-1 py-0.5 rounded hover:bg-gray-50"
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
        </div>
      );
    };

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
      const baseId = params?.baseId as string;
      const { isLoaded, isSignedIn } = useUser();

      // Authentication
      if (!isLoaded) return null;
      if (!isSignedIn) {
        router.push("/");
        return null;
      }

      // Refs
      const tableRef = useRef<HTMLDivElement>(null);
      const isColumnOperationRef = useRef(false);
      
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
      const activeCell = useUIStore((state) => state.activeCell);

      // Column operations state
      const isAddingColumn = useUIStore((state) => state.isAddingColumn);
      const newColumnName = useUIStore((state) => state.newColumnName);
      const newColumnType = useUIStore((state) => state.newColumnType);
      const editColumnName = useUIStore((state) => state.editColumnName);
      const contextRow = useUIStore((state) => state.contextRow);
      const columnContextMenu = useUIStore((state) => state.columnContextMenu);
      const isColumnSorted = (columnId: string): boolean => {
        return sortRules.some(rule => rule.columnId === columnId);
      };

      // Visibility state
      const columnVisibility = useUIStore((state) => state.columnVisibility);

      // Filter & sort state
      const filteredData = useUIStore((state) => state.filteredData);
      const sortRules = useUIStore((state) => state.sortRules);
      const sortedData = useUIStore((state) => state.sortedData);

      // Access user account
      const userProfile = useUIStore((state) => state.userProfile);

      const [searchTerm, setSearchTerm] = useState(""); // still local
      const [debouncedSearchTerm] = useDebounce(searchTerm, 200);

      // Setter (unified setter from the store)
      const set = useUIStore((state) => state.set);

      // ========================================================================================
      // Color Helper
      // ========================================================================================
      
      function stringToColor(str: string, lightness: number): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, ${lightness}%)`;
      }

      function isDarkColor(hsl?: string): boolean {
        if (typeof hsl !== "string") return false;

        const parts = hsl.split(",");
        if (parts.length < 3) return false;

        const lightnessStr = parts[2]?.replace("%", "").replace(")", "").trim();
        const lightness = lightnessStr ? parseInt(lightnessStr, 10) : NaN;

        return !isNaN(lightness) && lightness < 50;
      }

      const lighterColor = stringToColor(baseId, 90);

      // ========================================================================================
      // API QUERIES
      // ========================================================================================
      
      const { data: baseData, isLoading: isBaseLoading, error: baseError } =
        api.base.getBase.useQuery({ baseId });

      const { data: tableData, isLoading: isTableLoading } = 
        api.table.getTableById.useQuery({ 
          baseId: baseId!, 
          tableId: activeTableId! 
        }, {
          enabled: !!(baseId && activeTableId)
        });

      const { data: baseName, isLoading } = api.base.getBaseName.useQuery({
        baseId: baseId!,
      });

      // ========================================================================================
      // API MUTATIONS
      // ========================================================================================
      
      const addTable = api.table.addTable.useMutation({
        onError: (e) => console.error("Add table error:", e),
        onSuccess: () => void utils.table.getTableById.invalidate()
      });

      const updateColumnVisibility = api.table.updateColumnVisibility.useMutation({
        onError: (e) => console.error("Update column visibility error:", e),
        onSuccess: () => void utils.table.getTableById.invalidate()
      });

      const removeTable = api.table.deleteTable.useMutation({
        onError: (e) => console.error("Delete table error:", e),
        onSuccess: () => {
          utils.base.getBase.invalidate({ baseId });
        },
      });

      const createColumn = api.column.addColumn.useMutation({
        onError: (e) => console.error("Add column error:", e),
        onSuccess: () => void utils.table.getTableById.invalidate()
      });

      const removeColumn = api.column.deleteColumn.useMutation({
        onError: (e) => console.error("Delete column error:", e),
        onSuccess: () => void utils.table.getTableById.invalidate()
      });

      const createRow = api.row.addRow.useMutation({
        onError: (e) => console.error("Add row error:", e),
        onSuccess: (newRow) => {
          if (!activeTableId) return;

          utils.table.getTableById.setData({ baseId, tableId: activeTableId }, (old) => {
            if (!old) return old;
            return {
              ...old,
              rows: [...old.rows, newRow], // assumes newRow shape is { id, cells }
            };
          });
        },
      });

      const deleteRow = api.row.deleteRow.useMutation({
        onError: (e) => console.error("Delete row error:", e),
        onSuccess: ({ rowId }) => {
          if (!activeTableId) return;
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
          if (!activeTableId) return;
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
        onSuccess: (data) => {
          console.log("Sorted rows returned:", data);
          set({ sortedData: data });
        },
        onError: (err) => {
          console.error("Sort error:", err);
          set({ sortedData: null });
        },
      });

      const createManyRows = api.row.createManyRows.useMutation({
        onSuccess: () => {
          utils.table.getTableById.invalidate({ baseId, tableId: activeTableId! });
          toast.success("15,000 rows added!");
        },
        onError: () => {
          toast.error("Failed to create rows.");
        },
      });


      // ========================================================================================
      // EFFECTS
      // ========================================================================================
      
      // Set initial active table when base data loads
      useEffect(() => {
        if (baseData && baseData.tables[0]) {
          // setActiveTableId(baseData.tables[0].id);
          set({ activeTableId: baseData.tables[0].id });
        }
      }, [baseData]);

      // Initialize column visibility when table data loads
      useEffect(() => {
        if (!tableData) return;

        const visibilityState = tableData.columns.reduce((acc, col) => {
          acc[col.id] = col.visible;
          return acc;
        }, {} as Record<string, boolean>);
        // setColumnVisibility(visibilityState);
        set({ columnVisibility: visibilityState });
      }, [tableData]);

      // Reset filtered data when table data loads
      useEffect(() => {
        if (tableData) {
          // setFilteredData(null);
          set({ filteredData: null });
        }
      }, [tableData]);

      // Reset sorted data when active table changes
      useEffect(() => {
        // setSortedData(null);
        set({ sortedData: null });
      }, [activeTableId]);

      // Click outside handler
      useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
          if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
            // setSelectedRows(new Set());
            set({ selectedRows: new Set()});
            // setAllSelected(false);
            set({ allSelected: false});
            if (!isColumnOperationRef.current) {
              // setSelectedColIndex(null);
              set({selectedColIndex: null});
              // setColumnContextMenu(null);
              set({columnContextMenu: null});
            }
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }, []);

      // Focus active cell
      useEffect(() => {
        const input = document.querySelector(
          `[data-row="${activeCell?.row}"][data-col="${activeCell?.col}"]`
        ) as HTMLInputElement | null;
        input?.focus();
      }, [activeCell]);

      // ========================================================================================
      // EVENT HANDLERS
      // ========================================================================================
      
      const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        toast.dismiss();
      };

      const handleAddTable = async () => {
        if (!baseId) return;
        addTable.mutate({ baseId: baseId });
      };

      const handleDeleteTable = async (tableIdToDelete: string) => {
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
      };

      const handleAddColumn = () => {
        if (!baseId || !activeTableId) return;
        createColumn.mutate({ 
          tableId: activeTableId, 
          name: newColumnName, 
          type: newColumnType 
        });
      };

      const handleDeleteColumn = async (columnId: string) => {
        if (!baseId || !activeTableId) return;
        
        isColumnOperationRef.current = true;
        
        try {
          await removeColumn.mutateAsync({ columnId });
          // setSelectedColIndex(null);
          set({selectedColIndex: null});
          // setColumnContextMenu(null);
          set({columnContextMenu: null});
        } finally {
          setTimeout(() => {
            isColumnOperationRef.current = false;
          }, 100);
        }
      };

      const handleAddRow = () => {
        if (!baseId || !activeTableId) return;
        createRow.mutate({ tableId: activeTableId });
      };

      const handleDeleteRow = async (rowId: string) => {
        if (!baseId || !activeTableId) return;
        deleteRow.mutate({ rowId: rowId });
      };

      const handleRenameColumn = async (columnId: string, newName: string) => {
        if (!baseId || !activeTableId) return;
        
        isColumnOperationRef.current = true;
        
        try {
          await renameColumn.mutateAsync({ columnId: columnId, newName: newName });
        } finally {
          setTimeout(() => {
            isColumnOperationRef.current = false;
          }, 500);
        }
      };

      const handleApplySort = (rules: { columnId: string; direction: string }[]) => {
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
      };

      const handleToggleColumnVisibility = async (columnId: string) => {
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
      };

      const handleFilteredDataChange = (data: RowData[] | null) => {
        // setFilteredData(data);
        set({filteredData: data});
      };

      const toggleUserMenu = () => set({userProfile: !userProfile});

      // ========================================================================================
      // COMPUTED VALUES
      // ========================================================================================
      
      // Table columns definition
      const columns: ColumnDef<RowData>[] = useMemo(() => {
        if (!tableData || !activeTableId) return [];

        return tableData.columns
          .filter(col => columnVisibility[col.id] !== false)
          .map((col) => ({
            accessorKey: col.id,
            header: col.name,
            cell: (props: CellContext<RowData, unknown>) => (
              <EditableCell
                initialValue={String(props.getValue() ?? "")}
                tableId={activeTableId}
                rowId={props.row.id}
                columnId={props.column.id}
                searchTerm={debouncedSearchTerm}
              />
            ),
          }));
      }, [tableData, activeTableId, debouncedSearchTerm, columnVisibility]);

      // Transformed rows for TanStack
      const transformedRows = useMemo(() => {
        const sourceRows = sortedData ?? tableData?.rows ?? [];
        return sourceRows.map((row: any) => {
          const values: Record<string, any> = { id: row.id };
          for (const cell of row.cells ?? []) {
            values[cell.columnId] = cell.value ?? "";
          }
          return values;
        });
      }, [sortedData, tableData]);

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
            const cellValue = String(cell.value || '').toLowerCase();
            if (cellValue.includes(searchLower)) {
              totalMatches++;
            }
          });
        });

        return { totalMatches };
      }, [debouncedSearchTerm, tableData]);

      // Initialize TanStack table
      const table = useReactTable<RowData>({
        data: transformedRows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
      });

        // ref
      const tableContainerRef = useRef<HTMLDivElement>(null);
        
      const virtualizationData = useMemo(() => {
        if (filteredData !== null) {
          return filteredData;
        }
        return transformedRows;
      }, [filteredData, transformedRows]);

      const rowVirtualizer = useVirtualizer({
        count: virtualizationData.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 40, // Adjust this based on your row height
        overscan: 50, // Render 10 extra items outside the visible area for smoother scrolling
      });
      const virtualItems = rowVirtualizer.getVirtualItems();

      // ========================================================================================
      // LOADING & ERROR STATES
      // ========================================================================================
      
      if (isBaseLoading) {
        return (
          <div className="h-screen flex items-center justify-center text-gray-500 text-sm">
            Loading base...
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
              onClick={() => router.push("/")}
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
                style={{ backgroundColor: stringToColor(baseId, 50) }}
              >
                <Image
                  src="/airtable.png"
                  alt="Logo"
                  width={28}
                  height={28}
                  className={`object-contain ${isDarkColor(stringToColor(baseId, 50)) ? "invert" : ""}`}
                />
              </div>

              <div className="flex items-center gap-1">
                <div className="text-[18px] font-semibold text-gray-800 whitespace-nowrap">
                  {isLoading ? "Loading..." : baseName || "Untitled Base"}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-800" />
              </div>
            </div>

            {/* Center: Navigation links */}
            <nav className="flex items-center gap-6 text-sm text-gray-600">
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
              style={{ backgroundColor: stringToColor(baseId, 50) }}>
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
                        ? "bg-white text-black border-b-white font-medium"
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
                          onClick={() => handleDeleteTable(table.id)}
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
                className="flex items-center ml-2 px-2 py-1 text-[14px] text-gray-600 hover:text-gray-700 cursor-pointer"
              >
                + Add or Import
              </button>
            </div>

            <TableToolbar 
              onSearchChange={handleSearchChange} 
              searchResult={searchResults}
              onToggleColumnVisibility={handleToggleColumnVisibility}
              columns={tableData?.columns || []}
              columnVisibility={columnVisibility}
              tableId={tableData?.id || ""}
              data={filteredData}
              onFilteredDataChange={handleFilteredDataChange}
              sortRules={sortRules}
              setSortRules={(rules) => set({ sortRules: rules })}
              onApplySort={handleApplySort}
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
                  <p className="text-gray-500 mb-4">Loading table…</p>
                ) : tableData ? (
                  <div className="flex flex-col h-full">
                    {/* Single table with virtualized body */}
                    <div
                      ref={tableContainerRef}
                      className="flex-1 overflow-auto bg-white"
                      style={{ height: 'calc(100vh - 300px)' }}
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
                                  className={`relative group border-b border-r border-gray-300 px-2 py-1 text-sm text-gray-800 text-left hover:bg-gray-100 ${
                                    selectedColIndex === index ? "bg-blue-50" : ""
                                  } ${
                                    isColumnSorted(header.column.id) ? "bg-[ffe0cc]" : ""
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
                                                  handleRenameColumn(header.column.id, editColumnName);
                                                  // setSelectedColIndex(null);
                                                  set({selectedColIndex: null});
                                                }}
                                              >
                                                Save
                                              </button>
                                              <button
                                                className="text-gray-500 hover:underline text-xs"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // setSelectedColIndex(null);
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
                                                handleDeleteColumn(header.column.id);
                                                // setSelectedColIndex(null);
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
                                      className="w-full border px-2 py-1 mb-2 text-sm rounded"
                                      placeholder="Column name"
                                      value={newColumnName}
                                      onChange={(e) => set({newColumnName: e.target.value})}
                                    />
                                    <select
                                      className="w-full border px-2 py-1 mb-2 text-sm rounded"
                                      value={newColumnType}
                                      onChange={(e) =>  set({newColumnType: e.target.value})}
                                    >
                                      <option value="text">Text</option>
                                      <option value="number">Number</option>
                                    </select>
                                    <div className="flex justify-between gap-2">
                                      <button
                                        onClick={() => {
                                          handleAddColumn();
                                          // setIsAddingColumn(false);
                                          set({isAddingColumn: false});
                                          // setNewColumnName("");
                                          set({newColumnName: ""});
                                          // setNewColumnType("text");
                                          set({newColumnType: "text"});
                                        }}
                                        className="flex-1 bg-blue-600 text-white px-2 py-1 text-xs rounded"
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => set({isAddingColumn: false})}
                                        className="flex-1 bg-gray-200 text-black px-2 py-1 text-xs rounded"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => set({ isAddingColumn: true })}
                                    className="flex items-center justify-center p-1 hover:bg-gray-100 rounded"
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
                            <td colSpan={columns.length + 1} className="p-0">
                              <div
                                style={{
                                  height: `${rowVirtualizer.getTotalSize()}px`,
                                  width: '100%',
                                  position: 'relative',
                                }}
                              >
                                {/* Check if filter is applied and has results */}
                                {filteredData !== null ? (
                                  // Filter is applied
                                  filteredData.length > 0 ? (
                                    // Filter has results - render filtered data (virtualized)
                                    virtualItems.map((virtualRow) => {
                                      const rowData = filteredData[virtualRow.index];
                                      if (!rowData) return null;
                                      
                                      return (
                                        <div
                                          key={rowData.id}
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
                                            {table.getAllColumns().filter(col => col.getIsVisible()).map((column, index) => (
                                              <div
                                                key={`${rowData.id}-${column.id}`}
                                                data-row={virtualRow.index}
                                                data-col={index}
                                                onContextMenu={(e) => {
                                                  if (index === 0) {
                                                    e.preventDefault();
                                                    // setContextRow(rowData.id);
                                                    set({contextRow: rowData.id})
                                                  }
                                                }}
                                                  className={`relative border-t border-r border-gray-200 px-2 py-1 text-sm ${
                                                    selectedColIndex === index || selectedRows.has(rowData.id)
                                                      ? "bg-gray-100"
                                                      : ""
                                                  } ${
                                                    isColumnSorted(column.id) ? "bg-orange-100" : ""
                                                  }`}
                                                  style={{ 
                                                    display: 'table-cell',
                                                    width: index === 0 ? '200px' : '150px',
                                                    verticalAlign: 'middle'
                                                  }}
                                                >
                                                {index === 0 ? (
                                                  <div className="flex items-center gap-1.5 text-gray-700">
                                                    {/* Checkbox */}
                                                    <button
                                                      onClick={() => {
                                                        const newSet = new Set(selectedRows);
                                                        newSet.has(rowData.id) ? newSet.delete(rowData.id) : newSet.add(rowData.id);
                                                        // setSelectedRows(newSet);
                                                        set({selectedRows: newSet})
                                                        // setAllSelected(newSet.size === filteredData.length);
                                                        set({allSelected: newSet.size === filteredData.length})
                                                      }}
                                                    >
                                                      {selectedRows.has(rowData.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-gray-700" />
                                                      ) : (
                                                        <Square className="w-4 h-4 text-gray-700" />
                                                      )}
                                                    </button>

                                                    {/* Row index */}
                                                    <span className="w-5 text-right text-gray-500 whitespace-nowrap flex-shrink-0">
                                                      {virtualRow.index + 1}
                                                    </span>

                                                    {/* Cell content using EditableCell component */}
                                                    <div className="flex-1 whitespace-nowrap">
                                                      <EditableCell
                                                        initialValue={String(rowData.cells?.find((cell: Cell) => cell.columnId === column.id)?.value || '')}
                                                        tableId={activeTableId!}
                                                        rowId={rowData.id}
                                                        columnId={column.id}
                                                        searchTerm={debouncedSearchTerm}
                                                      />
                                                    </div>
                                                  </div>
                                                ) : (
                                                  // Non-first column - use EditableCell component
                                                  <EditableCell
                                                    initialValue={String(rowData.cells?.find((cell: Cell) => cell.columnId === column.id)?.value || '')}
                                                    tableId={activeTableId!}
                                                    rowId={rowData.id}
                                                    columnId={column.id}
                                                    searchTerm={debouncedSearchTerm}
                                                  />
                                                )}

                                                {/* Right-click dropdown for row deletion */}
                                                {contextRow === rowData.id && index === 0 && (
                                                  <div
                                                    className="absolute z-20 top-full left-0 bg-white border rounded shadow-md text-sm px-2 py-1 min-w-[160px] max-w-[220px] w-fit"
                                                  >
                                                    <button
                                                      className="text-red-500 hover:underline text-xs w-full text-left"
                                                      onClick={() => {
                                                        const confirmDelete = confirm("Are you sure you want to delete this row?");
                                                        if (confirmDelete) {
                                                          handleDeleteRow(rowData.id);
                                                          // setContextRow(null);
                                                          set({contextRow: null})
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
                                              style={{ 
                                                display: 'table-cell',
                                                width: '60px',
                                                padding: 0,
                                                border: 'none',
                                                background: 'transparent'
                                              }}
                                            ></div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    // Filter applied but no results
                                    <div 
                                      className="absolute inset-x-0 text-center py-8 text-gray-500"
                                      style={{ top: '0px' }}
                                    >
                                      No rows match the applied filters
                                    </div>
                                  )
                                ) : (
                                  // No filter applied - show normal table data (virtualized)
                                  <>
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
                                                        newSet.has(row.id) ? newSet.delete(row.id) : newSet.add(row.id);
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

                                                    <div className="flex-1 whitespace-nowra">
                                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  flexRender(cell.column.columnDef.cell, cell.getContext())
                                                )}

                                                {/* Right-click dropdown for row deletion */}
                                                {contextRow === row.id && index === 0 && (
                                                  <div
                                                    className="absolute z-20 top-full left-0 bg-white border rounded shadow-md text-sm px-2 py-1 min-w-[160px] max-w-[220px] w-fit"
                                                  >
                                                    <button
                                                      className="text-red-500 hover:underline text-xs w-full text-left"
                                                      onClick={() => {
                                                        const confirmDelete = confirm("Are you sure you want to delete this row?");
                                                        if (confirmDelete) {
                                                          handleDeleteRow(row.id);
                                                          // setContextRow(null);
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
                                  </>
                                )}
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
                          className="px-2 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border-r border-l border-b border-gray-200 flex items-center gap-2"
                          onClick={handleAddRow}
                        >
                          <Plus className="w-4 h-4" />
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