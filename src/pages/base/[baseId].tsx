import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

// Define the structure of Column, Row, Table, and Table data
// that will be used in the application
interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
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

export default function BasePage() {
  const router = useRouter();

  // use useMemo to memorize value of baseId based on current query param
  const baseId: string | null = useMemo(() => {
    if (!router.isReady) return null;
    const q = router.query.baseId;
    // if baseid = string -> return string. If it's array -> return the first element
    return typeof q === "string" ? q : Array.isArray(q) ? q[0] ?? null : null;
  }, [router.isReady, router.query.baseId]);

  const [tables, setTables] = useState<Table[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isBaseLoading, setIsBaseLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  useEffect(() => {
    if (!baseId) return;
    setIsBaseLoading(true);
    setErrorMsg(null);

    fetch(`/api/base/${baseId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Base fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        // get the the first table on display nothing is available -> active table is null
        setTables(data.tables ?? []);
        if (data.tables?.length > 0) {
          setActiveTableId(data.tables[0].id);
        } else {
          setActiveTableId(null);
        }
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setIsBaseLoading(false));
  }, [baseId]);

  useEffect(() => {
    if (!baseId || !activeTableId) {
      setTableData(null);
      return;
    }
    setIsTableLoading(true);
    setErrorMsg(null);

    fetch(`/api/base/${baseId}/table/${activeTableId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Table fetch failed (${res.status})`);
        return res.json();
      })
      .then((data: TableData) => setTableData(data))
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setIsTableLoading(false));
  }, [baseId, activeTableId]);

  //  handles the creation of a new table, performs an API request (fetch), 
  // and updates the component's state with the new table or error message based on the outcome of the request.
const handleAddTable = useCallback(async () => {
  if (!baseId) return;
  try {
    const res = await fetch(`/api/base/${baseId}/table`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled Table",
        columns: [], // or provide default columns
      }),
    });
    if (!res.ok) throw new Error(`Add table failed (${res.status})`);
    
    const newTable: Table = await res.json();
    setTables((prev) => [...prev, newTable]);
    setActiveTableId(newTable.id);  
  } catch (err: any) {
    setErrorMsg(err.message);
  }
}, [baseId]);

  const handleDeleteTable = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const res = await fetch(`/api/base/${baseId}/table/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Delete table failed (${res.status})`);

        setTables((prev) => {
          const updated = prev.filter((t) => t.id !== id);
          if (updated.length === 0) {
            setActiveTableId(null);
            setTableData(null);
          } else if (id === activeTableId) {
            setActiveTableId(updated[0]?.id ?? null);
          }
          return updated;
        });
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    },
    [baseId, activeTableId]
  );

  const handleAddColumn = useCallback(async () => {
    if (!baseId || !activeTableId) return;

    try {
      const res = await fetch(`/api/base/${baseId}/table/${activeTableId}/column`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Column",
          type: "text",
        }),
      });

      if (!res.ok) throw new Error("Failed to add column");

      const updated = await res.json();
      setTableData(updated);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }, [baseId, activeTableId]);

  const handleAddRow = useCallback(async () => {
    if (!baseId || !activeTableId) return;

    try {
      const res = await fetch(`/api/base/${baseId}/table/${activeTableId}/row`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to add row");

      const updated = await res.json();
      setTableData(updated);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }, [baseId, activeTableId]);

  const columns: ColumnDef<Record<string, any>>[] = useMemo(() => {
    return tableData?.columns.map((col) => ({
      accessorKey: col.id,
      header: col.name,
      cell: (info) => info.getValue() ?? "",
    })) ?? [];
  }, [tableData]);

  // 1. Flatten row data for TanStack
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

  // 2. Init table with transformed rows
  const table = useReactTable({
    data: transformedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r p-4 bg-white">
        <h2 className="text-xl font-semibold mb-4">Tables</h2>
        {isBaseLoading && (
          <p className="text-sm text-gray-500 mb-2">Loading tables…</p>
        )}
        <ul>
          {tables.map((table) => (
            <li key={table.id} className="flex items-center">
              <button
                className={`flex-1 text-left p-2 rounded ${
                  table.id === activeTableId
                    ? "bg-blue-100"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setActiveTableId(table.id)}
              >
                {table.name}
              </button>
              <button
                className="text-xs text-red-500 ml-2"
                onClick={() => handleDeleteTable(table.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={handleAddTable}
          className="mt-4 p-2 w-full text-sm border rounded hover:bg-gray-100"
        >
          + Add Table
        </button>
        {errorMsg && (
          <p className="mt-2 text-xs text-red-600 break-words">{errorMsg}</p>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {isTableLoading ? (
          <p className="text-gray-500 mb-4">Loading table…</p>
        ) : tableData ? (
          <>
            <h1 className="text-2xl font-semibold mb-4">{tableData.name}</h1>
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b px-4 py-2 text-sm font-medium text-left"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                    {/* Add Column Button */}
                    <th className="border-b px-4 py-2 text-sm text-blue-500">
                      <button onClick={() => handleAddColumn()}>
                        +
                      </button>
                    </th>
                  </tr>
                ))}
              </thead>

              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="even:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2 border-t text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td className="border-t px-4 py-2"></td> {/* Empty cell under Add Column */}
                  </tr>
                ))}

                {/* Add Row Button */}
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-3 text-sm text-blue-600 hover:bg-gray-50 cursor-pointer">
                    <button onClick={() => handleAddRow()}>
                      +
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-gray-500">No table selected.</p>
        )}
      </main>
    </div>
  );
}
