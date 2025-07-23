import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
}
interface Row {
  id: string;
  values: Record<string, string | number | null>;
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

  const baseId: string | null = useMemo(() => {
    if (!router.isReady) return null;
    const q = router.query.baseId;
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

  const handleAddTable = useCallback(async () => {
    if (!baseId) return;
    try {
      const res = await fetch(`/api/base/${baseId}/table`, { method: "POST" });
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
      if (!baseId) return;
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

  // ✅ Fixed: Move hook logic out of conditional render
  const columns: ColumnDef<Row>[] = useMemo(() => {
    return tableData?.columns.map((col) => ({
      accessorKey: col.id,
      header: col.name,
      cell: (info) => info.getValue() ?? "",
    })) ?? [];
  }, [tableData]);

  const table = useReactTable({
    data: tableData?.rows ?? [],
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
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="even:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2 border-t text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
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
