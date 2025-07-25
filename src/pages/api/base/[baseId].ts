import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId } = req.query;

  switch (req.method) {
    case "GET":
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

        const table = base.tables[0];
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

        return res.status(200).json({
          tables: base.tables.map((t) => ({
            id: t.id,
            name: t.name,
          })),
        });
      } catch (error) {
        console.error("GET base error:", error);
        return res.status(500).json({ error: "Server error" });
      }

    case "DELETE":
      try {
        const base = await prisma.base.findUnique({
          where: { id: baseId as string },
        });

        if (!base) {
          return res.status(404).json({ error: "Base not found." });
        }
      
        await prisma.base.delete({
          where: { id: baseId as string },
        });

        return res.status(200).json({ success: true, message: "Base deleted." });
      } catch (error) {
        console.error("DELETE base error:", error);
        return res.status(500).json({ error: "Internal server error." });
      }

    default:
      return res.status(405).json({ error: "Method Not Allowed." });
  }
}
