import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const cellRouter = createTRPCRouter({
  updateCell: privateProcedure
  .input(
    z.object({
      rowId: z.string(),
      columnId: z.string(),
      value: z.string().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Fix: avoid Prisma.JsonNull — it's unnecessary if value is typed as `Json`
    const updated = await ctx.db.cell.updateMany({
      where: {
        rowId: input.rowId,
        columnId: input.columnId,
      },
      data: {
        value: input.value,
      },
    });

    return updated;
  }),
});
