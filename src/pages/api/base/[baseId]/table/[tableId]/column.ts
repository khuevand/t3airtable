import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { tableId } = req.query;

  if (!tableId || typeof tableId !== "string") {
    return res.status(400).json({ error: "Missing or invalid tableId in query" });
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { name, type } = req.body;

    if (typeof name !== "string" || typeof type !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 1. Determine the next order value
    const existingColumns = await prisma.column.findMany({
      where: { tableId: tableId as string },
      orderBy: { order: "desc" },
    });

    const nextOrder = (existingColumns[0]?.order ?? 0) + 1;

    // 2. Create the column
    const newColumn = await prisma.column.create({
      data: {
        name,
        type,
        order: nextOrder,
        tableId: tableId as string,
      },
    });

    // 3. Add a blank cell for each existing row in that table
    const rows = await prisma.row.findMany({
      where: { tableId: tableId as string },
    });

    for (const row of rows) {
      await prisma.cell.create({
        data: {
          rowId: row.id,
          columnId: newColumn.id,
          value: "",
        },
      });
    }

    // 4. Return the updated table with columns and rows
    const updatedTable = await prisma.table.findUnique({
      where: { id: tableId as string },
      include: {
        columns: { orderBy: { order: "asc" } },
        rows: {
          include: {
            cells: true,
          },
        },
      },
    });

    res.status(200).json({
      name: updatedTable?.name,
      columns: updatedTable?.columns ?? [],
      rows:
        updatedTable?.rows.map((row) => ({
          id: row.id,
          cells: row.cells.map((cell) => ({
            columnId: cell.columnId,
            value: cell.value,
          })),
        })) ?? [],
    });
  } catch (err) {
    console.error("Error adding column:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
