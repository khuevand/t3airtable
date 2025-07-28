import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const cellRouter = createTRPCRouter({
  updateCell: privateProcedure
    .input(z.object({
      rowId: z.string(),
      columnId: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedValue =
        input.value === null ? Prisma.JsonNull : input.value;

      const updated = await ctx.db.cell.updateMany({
        where: {
          rowId: input.rowId,
          columnId: input.columnId,
        },
        data: {
          value: normalizedValue,
        },
      });

      return updated;
    }),
});
