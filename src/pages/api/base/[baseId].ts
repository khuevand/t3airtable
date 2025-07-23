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
            include: {
                tables: {
                include: {
                    columns: true,
                    rows: {
                    include: {
                        cells: true, // <-- This line is critical!
                    },
                    },
                },
                },
            },
        });

        if (!base || !base.tables.length) {
        return res.status(404).json({ error: "Base not found" });
        }

        const table = base.tables[0]; // Return first table for now
        const columns = table?.columns.map(({ id, name, type, order }) => ({ id, name, type, order }));
        const rows = table?.rows.map((row) => ({
        id: row.id,
        values: Object.fromEntries(
            row.cells.map((cell: any) => [cell.columnId, cell.value])
        ),
        }));

        res.status(200).json({ name: table?.name, columns, rows });
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Server error" });
    }
}
