import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const columnRouter = createTRPCRouter({
  addColumn: privateProcedure
    .input(
        z.object({
            tableId: z.string(),
            name: z.string(),
            type: z.string(),
        })
    )
    .mutation(async ({ ctx, input }) => {
    const { tableId, name, type } = input;
    // get total columns to organize them in order
    const columnCount = await ctx.db.column.count({
        where: { tableId },
    });

    const newColumn = await ctx.db.column.create({
        data: {
        tableId,
        name,
        type,
        order: columnCount,
        visible: true, 
        },
    });

    const rows = await ctx.db.row.findMany({
      where: { tableId },
      select: { id: true },
    });

    await ctx.db.cell.createMany({
      data: rows.map((row) => ({
        rowId: row.id,
        columnId: newColumn.id,
        value: "", 
      })),
    });

    return newColumn;
  }),

  deleteColumn: privateProcedure
    .input(z.object({ columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
        const { columnId } = input;

        const existing = await ctx.db.column.findUnique({
        where: { id: columnId },
    });
    if (!existing) throw new Error("Column not found");

    await ctx.db.column.delete({
        where: { id: columnId },
    });

    return { success: true, deletedColumnId: columnId };
    }),

  renameColumn: privateProcedure
    .input(z.object({ columnId: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.column.update({
        where: { id: input.columnId },
        data: { name: input.newName },
      });
      return { success: true, columnId: input.columnId, newName: input.newName };
    }),
  
  getColumns: privateProcedure
  .input(z.object({ tableId: z.string() }))
  .query(async ({ ctx, input }) => {
    const { tableId } = input;

    const columns = await ctx.db.column.findMany({
      where: { tableId },
      select: { id: true, name: true },
    });

    if (!columns) {
      throw new Error("Columns not found");
    }

    return columns;
  }),
});
