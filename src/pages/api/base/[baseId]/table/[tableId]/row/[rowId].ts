import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { rowId } = req.query;

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rowId || typeof rowId !== "string") {
    return res.status(400).json({ error: "Invalid row ID" });
  }

  try {
    // First, delete associated cells
    await prisma.cell.deleteMany({
      where: { rowId },
    });

    // Then delete the row itself
    const deletedRow = await prisma.row.delete({
      where: { id: rowId },
    });

    return res.status(200).json(deletedRow);
  } catch (err) {
    console.error("Failed to delete row:", err);
    return res.status(404).json({ error: "Row not found" });
  }
}
