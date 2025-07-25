import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { baseId } = req.query;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { name, columns } = req.body;

    if (!name || !Array.isArray(columns)) {
      return res.status(400).json({ error: "Missing or invalid name/columns" });
    }

    const newTable = await prisma.table.create({
      data: {
        name,
        base: {
          connect: {
            id: baseId as string,
          },
        },
        columns: {
          create: columns.map((col: any, index: number) => ({
            name: col.name,
            type: col.type,
            order: index,
          })),
        },
      },
      include: {
        columns: true,
      },
    });

    return res.status(201).json(newTable);
  } catch (error) {
    console.error("Error creating table:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
