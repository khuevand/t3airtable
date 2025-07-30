import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { createTRPCRouter } from "~/server/api/trpc";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { ChevronDown, CheckSquare, Square, Search, Settings, Table, } from "lucide-react";
import { api } from "~/utils/api";
import { useParams } from "next/navigation";
import { util } from "zod";
import { rename } from "fs";
import { toast } from "react-toastify";
import { useDebounce } from "use-debounce";
import TableToolbar from "~/components/tableToolBar";
import { highlightSearchTerm } from "~/components/highlightSearchTerm"

// Define the structure of Column, Row, Table, and Table data
// that will be used in the application
interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  visible: boolean; // Add this line
}
interface Row {
  id: string;
  cells: {
    columnId: string;
    value: string | number | null;
  }[];
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

type RowData = Record<string, any>;

interface EditableCellProps {
  initialValue: string;
  tableId: string;
  rowId: string;
  columnId: string;
  searchTerm?: string;
}

const EditableCell: React.FC<EditableCellProps & { searchTerm?: string }> = ({
  initialValue,
  tableId,
  rowId,
  columnId,
  searchTerm = '',
}) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const utils = api.useUtils();
  const updateCell = api.cell.updateCell.useMutation();

  const handleBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      updateCell.mutate(
        { rowId, columnId, value },
        {
          onSuccess: () => utils.table.getTableById.invalidate({ tableId }),
        }
      );
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  // Show highlighted text when not editing, regular input when editing
  if (isEditing) {
    return (
      <input
        className="w-full border-none bg-transparent focus:outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        autoFocus
      />
    );
  }

  // When not editing, show highlighted text
  const highlightedText = highlightSearchTerm(value, searchTerm);
  
  return (
    <div
      className="w-full cursor-text min-h-[20px]"
      onClick={handleFocus}
      dangerouslySetInnerHTML={{ __html: highlightedText }}
    />
  );
};

export default function BasePage() {
  const router = useRouter();

  const params = useParams();
  const baseId = params?.baseId as string;


  ////////////////////// NEW TRPC PART ///////////////////////

  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedColIndex, setSelectedColIndex] = useState<number | null>(null);
  const [allSelected, setAllSelected] = useState(false);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("New Column");
  const [newColumnType, setNewColumnType] = useState("text");
  const [editColumnName, setEditColumnName] = useState("");
  const [contextRow, setContextRow] = useState<string | null>(null);

  // boolean value for search function
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 200);

  // boolean value for hide/ show
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // boolean value for filter
  const [filteredData, setFilteredData] = useState<any[]>([]);

  // Fetch base info
  const { data: baseData, isLoading: isBaseLoading, error: baseError } =
    api.base.getBase.useQuery({ baseId });

  // Once baseData is fetched, set activeTableId
  useEffect(() => {
    if ( baseData && baseData.tables[0]) {
      setActiveTableId(baseData.tables[0].id);
    }
  }, [baseData]);

  // Fetch table data only when both baseId and activeTableId are available
  const { data: tableData, isLoading: isTableLoading } = api.table.getTableById.useQuery({ baseId: baseId!, tableId: activeTableId! });

  useEffect(() => {
    if (!tableData) return;

    // Initialize column visibility based on the fetched 'visible' field
    const visibilityState = tableData.columns.reduce((acc, col) => {
      acc[col.id] = col.visible;
      return acc;
    }, {} as Record<string, boolean>);

    setColumnVisibility(visibilityState);
  }, [tableData]);

  const addTable = api.table.addTable.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });

  const updateColumnVisibility = api.table.updateColumnVisibility.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });

  const removeTable = api.table.deleteTable.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });
  const createColumn = api.column.addColumn.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });
  const removeColumn = api.column.deleteColumn.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });
  const createRow = api.row.addRow.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });

  const deleteRow = api.row.deleteRow.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });

  const renameColumn = api.column.renameColumn.useMutation({
    onError: (e) => {
      console.error("Delete row error occurred:", e);
    },
    onSuccess: () => {
      void utils.table.getTableById.invalidate();
    }
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

  const utils = api.useUtils(); // for refetch if needed

  const updateCell = api.cell.updateCell.useMutation({
    onSuccess: () => {
      utils.table.getTableById.invalidate(); // if you want to refresh table
    },
  });

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    toast.dismiss();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedRows(new Set());
        setAllSelected(false);
        setSelectedColIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const input = document.querySelector(
      `[data-row="${activeCell?.row}"][data-col="${activeCell?.col}"]`
    ) as HTMLInputElement | null;
    input?.focus();
  }, [activeCell]);

  // //  handles the creation of a new table, performs an API request (fetch), 
  // // and updates the component's state with the new table or error message based on the outcome of the request.
  // const handleBlur = (rowId: string, columnId: string, value: string) => {
  //   if (!baseId) return;
  //   updateCell.mutate({ rowId: rowId, columnId: columnId, value: value });
  // };
  
  // wait for the creation of previous table to avoid duplication/ out of order name
  const handleAddTable = async () => {
    if (!baseId) return;
    addTable.mutate({ baseId: baseId });
  };

  const handleDeleteTable = async (tableIdToDelete: string) => {
    if (!baseId || !activeTableId) return;

    try {
      await removeTable.mutateAsync({ tableId: tableIdToDelete });

      // Invalidate and refetch base data
      await utils.base.getBase.invalidate({ baseId });

      // Refetch the updated list of tables
      const updatedBase = await utils.base.getBase.fetch({ baseId });

      if (updatedBase?.tables.length > 0) {
        // Prefer next table, fallback to first one
        const fallbackTable =
          updatedBase.tables.find((t) => t.id !== tableIdToDelete) ??
          updatedBase.tables[0];

        if (fallbackTable) {
          setActiveTableId(fallbackTable.id);
        } else {
          setActiveTableId(null); // No tables left
        }
      } else {
        // No tables left
        setActiveTableId(null);
      }
    } catch (err) {
      console.error("Failed to delete table", err);
    }
  };


  const handleAddColumn = () => {
    if (!baseId || !activeTableId) return;
    createColumn.mutate({ tableId: activeTableId, name: newColumnName, type: newColumnType});
  };

  const handleDeleteColumn = ( columnId: string ) => {
    if (!baseId || !activeTableId) return;
    removeColumn.mutate({ columnId });
  };

  // function to add new row to the table
  const handleAddRow = () => {
    if (!baseId || !activeTableId) return;
    createRow.mutate({tableId: activeTableId});
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!baseId || !activeTableId) return;
    deleteRow.mutate({ rowId: rowId});
  };

  const handleRenameColumn = async (columnId: string, newName: string) => {
    if (!baseId || !activeTableId) return;
    renameColumn.mutate({ columnId: columnId, newName: newName});
  };

  // 4. Update your columns definition to pass search term
  const columns: ColumnDef<RowData>[] = useMemo(() => {
    if (!tableData || !activeTableId) return [];

    return tableData.columns
      .filter(col => columnVisibility[col.id] !== false) // Only show visible columns
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

  // Flatten row data for TanStack
  const transformedRows = useMemo(() => {
    if (!tableData) return [];
    return tableData.rows.map((row) => {
      const values: Record<string, any> = { id: row.id };
      (row.cells ?? []).forEach((cell) => {
        values[cell.columnId] = cell.value ?? "";
      });
      return values;
    });
  }, [tableData]);

  // Init table with transformed rows
  const table = useReactTable({
    data: transformedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id, // retrieve row unique id for deletion
  });

  // 1. First, add search results calculation
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

  const handleToggleColumnVisibility = async (columnId: string) => {
    const newVisibility = !columnVisibility[columnId];
    setColumnVisibility((prev) => ({ ...prev, [columnId]: newVisibility }));

    // Use the already defined mutation hook
    updateColumnVisibility.mutate({
      columnId,
      visible: newVisibility,
    });
  };

  const handleFilteredDataChange = (data: any[] | null) => {
    if (data) {
      setFilteredData(data);  // Update the filtered data
    } else {
      // Check if tableData is undefined, then reset the state accordingly
      if (tableData) {
        setFilteredData(tableData.rows);  // Assuming tableData.rows contains the rows you want to display
      } else {
        setFilteredData([]);  // If tableData is undefined, reset to an empty array
      }
    }
  };

  // Create helper to navigate between each cell
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
      const maxRows = table.getRowModel().rows.length;
      const maxCols = table.getAllColumns().length;

      if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "Tab"].includes(e.key)) {
        e.preventDefault(); // Prevent default tab behavior
      }

      if (e.key === "ArrowDown" || e.key === "Enter") {
        setActiveCell({ row: Math.min(rowIndex + 1, maxRows - 1), col: colIndex });
      } else if (e.key === "ArrowUp") {
        setActiveCell({ row: Math.max(rowIndex - 1, 0), col: colIndex });
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        setActiveCell({ row: rowIndex, col: Math.min(colIndex + 1, maxCols - 1) });
      } else if (e.key === "ArrowLeft") {
        setActiveCell({ row: rowIndex, col: Math.max(colIndex - 1, 0) });
      }
    };

      // Handle loading
  if (isBaseLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading base...
      </div>
    );
  }

  // Handle error or missing base
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


  return (
    <div className="h-screen flex">
      {/* OUTERMOST Sidebar - App Navigation */} 
      <div className="w-14 bg-white border-r flex flex-col justify-between items-center py-4">
        {/* Top: Logo */}
        <div className="w-7 h-7">
          <svg viewBox="0 0 512 512" fill="black" width="100%" height="100%">
            <path d="M256 0L512 192H0L256 0Z" />
            <path d="M512 192L256 384L0 192H512Z" />
          </svg>
        </div>

        {/* Middle: Placeholders */}
        <div className="flex flex-col items-center gap-6 mt-8">
          <div className="w-5 h-5 rounded-full border-2 border-gray-500 animate-spin" />
          <div className="w-5 h-5 rounded-full bg-gray-300" title="Help" />
          <div className="w-5 h-5 rounded-full bg-gray-300" title="Notifications" />
        </div>

        {/* Bottom: K Profile */}
        <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full text-sm font-bold">
          K
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - spans full width of main content */}
        <header className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-200">
          {/* Left: Logo + Base */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-yellow-700 flex items-center justify-center">
              <svg viewBox="0 0 512 512" fill="white" width="16" height="16">
                <path d="M256 0L512 192H0L256 0Z" />
                <path d="M512 192L256 384L0 192H512Z" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-gray-800">
              Untitled Base <span className="ml-1">▼</span>
            </h1>
          </div>

          {/* Middle: Navigation */}
          <nav className="flex items-center space-x-6 text-sm text-gray-600">
            <a href="#" className="font-medium text-black">Data</a>
            <a href="#" className="hover:text-black">Automations</a>
            <a href="#" className="hover:text-black">Interfaces</a>
            <a href="#" className="hover:text-black">Forms</a>
          </nav>

          {/* Right: Buttons */}
          <div className="flex items-center gap-3 text-xs">
            <button title="Undo">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="w-4 h-4 text-gray-500">
                <path d="M9 5H3v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 5c2-2 5-3 8-2s5.3 4.6 4 7.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Trial: 7 days left</span>
            <a href="#" className="text-blue-600 hover:underline">See what's new</a>
            <button className="bg-yellow-700 text-white text-xs px-3 py-1 rounded-md font-medium hover:bg-yellow-800">
              Share
            </button>
          </div>
        </header>

        {/* Table Tabs Section */}
        <div className="flex items-center bg-[#fff9e8] border-b border-gray-200 px-4 py-2 text-sm relative">
          {baseData.tables.map((table) => (
            <div key={table.id} className="relative mr-2">
              <div
                className={`flex items-center px-4 py-1 rounded-t-md border cursor-pointer ${
                  table.id === activeTableId
                    ? "bg-white text-black border-b-white font-medium"
                    : "text-gray-500 hover:text-black border-transparent"
                }`}
              >
                <button onClick={() => setActiveTableId(table.id)} className="mr-1">
                  {table.name}
                </button>
                <ChevronDown
                  size={16}
                  className="text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdownId((prev) => (prev === table.id ? null : table.id));
                  }}
                />
              </div>

              {/* Dropdown menu */}
              {openDropdownId === table.id && (
                <div className="absolute z-10 top-full mt-1 left-0 w-56 bg-white border border-gray-200 shadow-lg rounded-md p-1">
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
            className="flex items-center ml-2 px-2 py-1 text-[14px] text-gray-500 hover:text-gray-700"
          >
            + Add or Import
          </button>
        </div>

        <TableToolbar 
          onSearchChange={handleSearchChange} 
          searchResult={searchResults}
          onToggleColumnVisibility={handleToggleColumnVisibility}
          columns={tableData?.columns || []}
          tableId={tableData?.id || ""}
          data={filteredData}  // Pass filteredData to the table
          onFilteredDataChange={handleFilteredDataChange}
        />

        {/* Main Content with Sidebar and Table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT Sidebar with View Controls */}
          <aside className="w-56 bg-white border-r border-gray-200 p-3 flex flex-col gap-2 text-sm">
            <button className="text-left flex items-center gap-2 px-3 py-2 bg-gray-100 rounded">
              ➕ Create new...
            </button>
            <div className="flex items-center gap-2 px-3">
              <Search className="w-4 h-4"/>
              <span className="text-gray-500">Find a view</span>
              <Settings className="w-4 h-4"/>
            </div>
            <div className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 text-blue-600 font-medium">
              <Table className="w-4 h-4"/>
              <span className="text-gray-500">Grid View</span>
            </div>
          </aside>

          {/* Table Content */}
          <main ref={tableRef} className="flex-1 overflow-auto bg-gray-50">
            {isTableLoading ? (
              <p className="text-gray-500 mb-4">Loading table…</p>
            ) : tableData ? (
              <table className="min-w-full border border-gray-300 bg-white table-fixed">
                <thead className="bg-white">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header, index) => (
                        <th
                          key={header.id}
                          onContextMenu={() => {
                            setSelectedColIndex(index);
                            setActiveCell({ row: 0, col: index });
                            setEditColumnName(header.column.columnDef.header as string);
                          }}
                          className={`relative group border-b border-r border-gray-300 px-2 py-1 text-sm text-gray-800 text-left hover:bg-gray-100 ${
                            selectedColIndex === index ? "bg-blue-50" : ""
                          }`}
                        >
                          {index === 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allIds = table.getRowModel().rows.map((r) => r.id);
                                  const newSelected = new Set(allSelected ? [] : allIds);
                                  setSelectedRows(newSelected);
                                  setAllSelected(!allSelected);
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
                                  <div className="absolute top-full mt-1 right-0 z-10 w-44 bg-white border rounded shadow text-sm p-2">
                                    <div className="mb-2">
                                      <label className="block text-gray-600 mb-1">Rename column</label>
                                      <input
                                        type="text"
                                        value={editColumnName}
                                        onChange={(e) => setEditColumnName(e.target.value)}
                                        className="w-full border px-2 py-1 rounded text-sm"
                                        placeholder="New name"
                                      />
                                      <div className="flex justify-end gap-2 mt-1">
                                        <button
                                          className="text-blue-600 hover:underline text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRenameColumn(header.column.id, editColumnName);
                                            setSelectedColIndex(null);
                                          }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          className="text-gray-500 hover:underline text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedColIndex(null);
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
                                          setSelectedColIndex(null);
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
                      <th className="border-b border-gray-300 px-2 py-1 text-sm text-blue-500 text-left relative">
                        {isAddingColumn ? (
                          <div className="absolute z-10 bg-white shadow-md border rounded p-2 w-48 right-0">
                            <input
                              type="text"
                              className="w-full border px-2 py-1 mb-2 text-sm rounded"
                              placeholder="Column name"
                              value={newColumnName}
                              onChange={(e) => setNewColumnName(e.target.value)}
                            />
                            <select
                              className="w-full border px-2 py-1 mb-2 text-sm rounded"
                              value={newColumnType}
                              onChange={(e) => setNewColumnType(e.target.value)}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                            </select>
                            <div className="flex justify-between gap-2">
                              <button
                                onClick={() => {
                                  handleAddColumn();
                                  setIsAddingColumn(false);
                                  setNewColumnName("");
                                  setNewColumnType("text");
                                }}
                                className="flex-1 bg-blue-600 text-white px-2 py-1 text-xs rounded"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setIsAddingColumn(false)}
                                className="flex-1 bg-gray-200 text-black px-2 py-1 text-xs rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setIsAddingColumn(true)}>+</button>
                        )}
                      </th>
                    </tr>
                  ))}
                </thead>
                  <tbody>
                    {/* Render filtered data if available, otherwise render normal table data */}
                    {filteredData && filteredData.length > 0 ? (
                      // Filtered data rendering
                      filteredData.map((rowData, rowIndex) => (
                        <tr key={rowData.id} className="hover:bg-gray-100">
                          {table.getAllColumns().filter(col => col.getIsVisible()).map((column, index) => (
                            <td
                              key={`${rowData.id}-${column.id}`}
                              data-row={rowIndex}
                              data-col={index}
                              onContextMenu={(e) => {
                                if (index === 0) {
                                  e.preventDefault();
                                  setContextRow(rowData.id);
                                }
                              }}
                              className={`relative border-t border-r border-gray-200 px-2 py-1 text-sm last:border-r-0 ${
                                selectedColIndex === index || selectedRows.has(rowData.id)
                                  ? "bg-gray-100"
                                  : ""
                              }`}
                            >
                              {index === 0 ? (
                                <div className="flex items-center gap-2 text-gray-700">
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => {
                                      const newSet = new Set(selectedRows);
                                      newSet.has(rowData.id) ? newSet.delete(rowData.id) : newSet.add(rowData.id);
                                      setSelectedRows(newSet);
                                      setAllSelected(newSet.size === filteredData.length);
                                    }}
                                  >
                                    {selectedRows.has(rowData.id) ? (
                                      <CheckSquare className="w-4 h-4 text-gray-700" />
                                    ) : (
                                      <Square className="w-4 h-4 text-gray-700" />
                                    )}
                                  </button>

                                  {/* Row index */}
                                  <span className="w-5 text-right">{rowIndex + 1}</span>

                                  {/* Cell content - find the cell data for this column */}
                                  {rowData.cells?.find((cell: any) => cell.columnId === column.id)?.value || ''}
                                </div>
                              ) : (
                                // Non-first column - display cell content
                                rowData.cells?.find((cell: any) => cell.columnId === column.id)?.value || ''
                              )}

                              {/* Right-click dropdown for row deletion */}
                              {contextRow === rowData.id && index === 0 && (
                                <div className="absolute z-10 top-full left-0 bg-white border rounded shadow text-sm px-2 py-1 w-32">
                                  <button
                                    className="text-red-500 hover:underline text-xs w-full text-left"
                                    onClick={() => {
                                      const confirmDelete = confirm("Are you sure you want to delete this row?");
                                      if (confirmDelete) {
                                        console.log("Deleting row:", rowData);
                                        console.log("row.id being sent to API:", rowData.id);
                                        handleDeleteRow(rowData.id);
                                        setContextRow(null);
                                      }
                                    }}
                                  >
                                    Delete row
                                  </button>
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filteredData !== null && filteredData.length === 0 ? (
                      // No results found for filter
                      <tr>
                        <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                          No rows match the applied filters
                        </td>
                      </tr>
                    ) : (
                      // Normal table data rendering (when no filter is applied)
                      table.getRowModel().rows.map((row, rowIndex) => (
                        <tr key={row.id} className="hover:bg-gray-100">
                          {row.getVisibleCells().map((cell, index) => (
                            <td
                              key={cell.id}
                              data-row={rowIndex}
                              data-col={index}
                              onContextMenu={(e) => {
                                if (index === 0) {
                                  e.preventDefault();
                                  setContextRow(row.id);
                                }
                              }}
                              className={`relative border-t border-r border-gray-200 px-2 py-1 text-sm last:border-r-0 ${
                                selectedColIndex === index || selectedRows.has(row.id)
                                  ? "bg-gray-100"
                                  : ""
                              }`}
                            >
                              {index === 0 ? (
                                <div className="flex items-center gap-2 text-gray-700">
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => {
                                      const newSet = new Set(selectedRows);
                                      newSet.has(row.id) ? newSet.delete(row.id) : newSet.add(row.id);
                                      setSelectedRows(newSet);
                                      setAllSelected(newSet.size === table.getRowModel().rows.length);
                                    }}
                                  >
                                    {selectedRows.has(row.id) ? (
                                      <CheckSquare className="w-4 h-4 text-gray-700" />
                                    ) : (
                                      <Square className="w-4 h-4 text-gray-700" />
                                    )}
                                  </button>

                                  {/* Row index */}
                                  <span className="w-5 text-right">{row.index + 1}</span>

                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                              ) : (
                                flexRender(cell.column.columnDef.cell, cell.getContext())
                              )}

                              {/* Right-click dropdown for row deletion */}
                              {contextRow === row.id && index === 0 && (
                                <div className="absolute z-10 top-full left-0 bg-white border rounded shadow text-sm px-2 py-1 w-32">
                                  <button
                                    className="text-red-500 hover:underline text-xs w-full text-left"
                                    onClick={() => {
                                      const confirmDelete = confirm("Are you sure you want to delete this row?");
                                      if (confirmDelete) {
                                        console.log("Deleting row:", row);
                                        console.log("row.id being sent to API:", row.id);
                                        handleDeleteRow(row.id);
                                        setContextRow(null);
                                      }
                                    }}
                                  >
                                    Delete row
                                  </button>
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}

                    {/* Add Row Button - only show when no filter is applied */}
                    {(!filteredData || filteredData === null) && (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="text-center py-3 text-sm text-gray-500 hover:bg-gray-100 cursor-pointer"
                        >
                          <button onClick={handleAddRow}>+ Add row</button>
                        </td>
                      </tr>
                    )}
                  </tbody>

              </table>
            ) : (
              <p className="text-gray-500">No table selected.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
