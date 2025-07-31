// src/server/api/routers/sortRouter.ts
import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const sortRouter = createTRPCRouter({
  getSortedRecords: privateProcedure
    .input(
      z.object({
        tableId: z.string(),
        sortBy: z.array(
          z.object({
            columnId: z.string(),
            direction: z.enum(["asc", "desc"]),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tableId, sortBy } = input;

      const rows = await ctx.db.row.findMany({
        where: {
          tableId,
        },
        include: {
          cells: true,
        },
      });

      const sortedRows = [...rows].sort((a, b) => {
        for (const sort of sortBy) {
          const aRaw = a.cells.find(c => c.columnId === sort.columnId)?.value ?? "";
          const bRaw = b.cells.find(c => c.columnId === sort.columnId)?.value ?? "";

          const aValue = typeof aRaw === "string" ? aRaw : String(aRaw);
          const bValue = typeof bRaw === "string" ? bRaw : String(bRaw);

          // Try numeric sort first
          const aNum = parseFloat(aValue);
          const bNum = parseFloat(bValue);
          const isNumeric = !isNaN(aNum) && !isNaN(bNum);

          if (isNumeric) {
            if (aNum < bNum) return sort.direction === "asc" ? -1 : 1;
            if (aNum > bNum) return sort.direction === "asc" ? 1 : -1;
          } else {
            if (aValue < bValue) return sort.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sort.direction === "asc" ? 1 : -1;
          }
        }
        return 0; // keep order if equal
      });

      return sortedRows;
    }),
});
