// pages/api/base/[baseId]/table/[tableId]/row.ts

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
    // 1. Get all columns of the table
    const columns = await prisma.column.findMany({
      where: { tableId: tableId as string },
    });

    // 2. Create a new row with one blank cell per column
    const newRow = await prisma.row.create({
      data: {
        tableId: tableId as string,
        cells: {
          create: columns.map((column) => ({
            columnId: column.id,
            value: "", // default blank cell
          })),
        },
      },
    });

    // 3. Fetch updated table data (with columns and rows)
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

    return res.status(200).json({
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
    console.error("Error creating row:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
