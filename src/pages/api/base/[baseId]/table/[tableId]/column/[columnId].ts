import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { columnId } = req.query;

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!columnId || typeof columnId !== "string") {
    return res.status(400).json({ error: "Missing or invalid columnId" });
  }

  try {
    // Delete all associated cells first to avoid foreign key issues
    await prisma.cell.deleteMany({
      where: {
        columnId: columnId,
      },
    });

    // Delete the column
    const deletedColumn = await prisma.column.delete({
      where: {
        id: columnId,
      },
    });

    return res.status(200).json(deletedColumn);
  } catch (err) {
    console.error("Error deleting column:", err);
    return res.status(404).json({ error: "Column not found or already deleted" });
  }
}
