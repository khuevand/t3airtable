import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId } = req.query;
  const prisma = new PrismaClient();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const base = await prisma.base.findUnique({
    where: { id: baseId as string },
        select: {
            id: true,
            name: true,
            updatedAt: true,
            tables: {
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
            },
        },
    });

    if (!base || !base.tables.length) {
      return res.status(404).json({ error: "Base not found" });
    }

    const table = base.tables[0]; // Return first table
    const columns = table?.columns.map(({ id, name, type, order }) => ({
      id,
      name,
      type,
      order,
    }));

    const rows = table?.rows.map((row) => ({
      id: row.id,
      values: Object.fromEntries(
        row.cells.map((cell: any) => [cell.columnId, cell.value])
      ),
    }));

    res.status(200).json({
    tables: base.tables.map((t) => ({
        id: t.id,
        name: t.name,
    })),
    });
  } catch (error) {
    console.error(":D Fetch error:", error);
    res.status(500).json({ error: "Server error" });
  }
}
