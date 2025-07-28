import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId } = req.query;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (typeof baseId !== "string") {
    return res.status(400).json({ error: "Invalid baseId" });
  }

  try {
    // Default schema
    const defaultColumns = [
      { name: "Name", type: "text", order: 0 },
      { name: "Notes", type: "text", order: 1 },
      { name: "Assignee", type: "text", order: 2 },
      { name: "Status", type: "text", order: 3 },
      { name: "Attachments", type: "file", order: 4 },
    ];

    // 1. Create the table
    const newTable = await prisma.table.create({
      data: {
        id: uuidv4(),
        name: "Untitled Table",
        baseId,
        columns: {
          create: defaultColumns,
        },
      },
      include: { columns: true },
    });

    // 2. Create 3 default rows with blank cells for each column
    for (let i = 0; i < 3; i++) {
      await prisma.row.create({
        data: {
          tableId: newTable.id,
          cells: {
            create: newTable.columns.map((col) => ({
              columnId: col.id,
              value: "",
            })),
          },
        },
      });
    }

    // 3. Return newly created table
    return res.status(200).json({
      id: newTable.id,
      name: newTable.name,
      baseId,
      columns: newTable.columns,
    });
  } catch (error) {
    console.error("Error creating table:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
