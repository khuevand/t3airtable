// pages/api/base/[baseId]/table/[tableId].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId, tableId } = req.query;
  console.log("YESSS");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("HIIII");
    const table = await prisma.table.findFirst({
      where: {
        id: tableId as string,
        baseId: baseId as string,
      },
      select: {
        id: true,
        name: true,
        columns: {
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
          },
        },
        rows: {
          select: {
            id: true,
            cells: {
              select: {
                columnId: true,
                value: true,
              },
            },
          },
        },
      },
    });
    console.log("Find table:", table);


    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    const columns = table.columns;
    const rows = table.rows.map((row) => ({
      id: row.id,
      values: Object.fromEntries(row.cells.map((cell) => [cell.columnId, cell.value])),
    }));

    res.status(200).json({
      name: table.name,
      columns,
      rows,
    });
  } catch (err) {
    console.error("Error fetching table:", err);
    res.status(500).json({ error: "Server error" });
  }
}
