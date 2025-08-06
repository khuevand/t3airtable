import { z } from "zod";
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
