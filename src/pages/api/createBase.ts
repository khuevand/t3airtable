// pages/api/createBase.ts
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // 1. Create Base
    const base = await prisma.base.create({
      data: {
        id: uuidv4(),
        name: "Untitled Base",
      },
    });

    // 2. Define default columns
    const defaultColumns = [
      { name: "Name", type: "text", order: 0 },
      { name: "Notes", type: "text", order: 1 },
      { name: "Assignee", type: "text", order: 2 },
      { name: "Status", type: "text", order: 3 },
      { name: "Attachments", type: "file", order: 4 },
    ];

    // 3. Create Table with Columns
    const table = await prisma.table.create({
      data: {
        name: "Table 1",
        baseId: base.id,
        columns: {
          create: defaultColumns,
        },
      },
      include: { columns: true },
    });

    // 4. Create 3 empty rows with blank cells for each column
    for (let i = 0; i < 3; i++) {
      await prisma.row.create({
        data: {
          tableId: table.id,
          cells: {
            create: table.columns.map((column) => ({
              columnId: column.id,
              value: "", // Empty value for now
            })),
          },
        },
      });
    }

    // 5. Return response
    return res.status(200).json({
      baseId: base.id,
      table: {
        id: table.id,
        name: table.name,
      },
    });
  } catch (err) {
    console.error("Failed to create base:", err);
    return res.status(500).json({ message: "Failed to create base" });
  }
}
