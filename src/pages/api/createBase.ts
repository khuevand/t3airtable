import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const prisma = new PrismaClient();
    if (req.method !== "POST") return res.status(405).end();
    
    try {
        const base = await prisma.base.create({
        data: {
            id: uuidv4(),
            name: "Untitled Base",
            tables: {
            create: {
                name: "Table 1",
                columns: {
                create: [
                    { name: "Name", type: "text", order: 0 },
                    { name: "Notes", type: "text", order: 1 },
                    { name: "Assignee", type: "text", order: 2 },
                    { name: "Status", type: "text", order: 3 },
                    { name: "Attachments", type: "file", order: 4 },
                ],
                },
            },
            },
        },
        include: {
            tables: true,
        },
        });

        const table = base.tables[0];
        return res.status(200).json({ baseId: base.id, tableId: table?.id });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Failed to create base" });
    }
}
