// pages/api/base/[baseId]/table/[tableId].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId, tableId } = req.query;

  if (typeof tableId !== "string" || typeof baseId !== "string") {
    return res.status(400).json({ error: "Invalid baseId or tableId" });
  }

  try {
    if (req.method === "GET") {
      const table = await prisma.table.findFirst({
        where: {
          id: tableId,
          baseId,
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

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      const columns = table.columns;
      const rows = table.rows.map((row) => ({
        id: row.id,
        values: Object.fromEntries(row.cells.map((cell) => [cell.columnId, cell.value])),
      }));

      return res.status(200).json({
        name: table.name,
        columns,
        rows,
      });
    }

    // ✅ DELETE method
    if (req.method === "DELETE") {
      // Step 1: Delete all cells linked to rows in the table
      await prisma.cell.deleteMany({
        where: {
          row: {
            tableId,
          },
        },
      });

      // Step 2: Delete all rows in the table
      await prisma.row.deleteMany({
        where: {
          tableId,
        },
      });

      // Step 3: Delete all columns in the table
      await prisma.column.deleteMany({
        where: {
          tableId,
        },
      });

      // Step 4: Delete the table itself
      await prisma.table.delete({
        where: {
          id: tableId,
        },
      });

      return res.status(204).end(); // Success, no content
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error handling table request:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
