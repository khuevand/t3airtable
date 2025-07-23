import { useRouter } from "next/router";
import { useEffect, useState } from "react";

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

interface TableData {
  name: string;
  columns: Column[];
  rows: Row[];
}

export default function BasePage() {
  const { baseId } = useRouter().query;
  const [table, setTable] = useState<TableData | null>(null);

  useEffect(() => {
    if (!baseId) return;

    fetch(`/api/base/${baseId}`)
      .then((res) => res.json())
      .then((data) => setTable(data))
      .catch(console.error);
  }, [baseId]);

  if (!table) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{table.name}</h1>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {table.columns.map((col) => (
              <th
                key={col.id}
                className="border-b border-gray-300 px-4 py-2 text-left text-sm font-medium"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="even:bg-gray-50">
              {table.columns.map((col) => (
                <td key={col.id} className="px-4 py-2 text-sm border-t">
                  {row.values[col.id] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
