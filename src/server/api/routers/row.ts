import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
    addRow: privateProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
        // Fetch all columns for the table
        const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        });

        // Create the row with empty cells for each column
        const row = await ctx.db.row.create({
        data: {
            tableId: input.tableId,
            cells: {
            create: columns.map((col) => ({
                columnId: col.id,
                value: "", // or null, depending on your data structure
            })),
            },
        },
        include: {
            cells: true,
        },
        });

        return row;
    }),

    deleteRow: privateProcedure
    .input(z.object({ rowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
        // Delete all cells belonging to the row first (if no cascade)
        await ctx.db.cell.deleteMany({
        where: { rowId: input.rowId },
        });

        // Then delete the row
        await ctx.db.row.delete({
        where: { id: input.rowId },
        });

        return { success: true };
    }),
});
