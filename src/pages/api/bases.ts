// pages/api/getBases.ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bases = await prisma.base.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(bases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bases" });
  }
}
