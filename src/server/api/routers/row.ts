import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";


export const rowRouter = createTRPCRouter({
  addRow: privateProcedure
  .input(z.object({ tableId: z.string() }))
  .mutation(async ({ ctx, input }) => {
      const columns = await ctx.db.column.findMany({
      where: { tableId: input.tableId },
      });

      const row = await ctx.db.row.create({
      data: {
          tableId: input.tableId,
          cells: {
          create: columns.map((col) => ({
              columnId: col.id,
              value: "",
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
      // Delete all cells belonging to the row first
      await ctx.db.cell.deleteMany({
      where: { rowId: input.rowId },
      });

      // Then delete the row
      await ctx.db.row.delete({
      where: { id: input.rowId },
      });

      return { success: true, rowId: input.rowId  };
    }),

  createManyRowsBatch: privateProcedure
    .input(z.object({
      tableId: z.string(),
      count: z.number().min(1).max(1000),
      batchNumber: z.number().min(1),
      totalBatches: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { tableId, count, batchNumber, totalBatches } = input;

      const columns = await ctx.db.column.findMany(
        { where: { tableId } }
      );
      
      if (!columns.length) throw new Error("No columns found for this table");

      const rowsData = Array.from({ length: count }).map(() => ({
        id: crypto.randomUUID(),
        tableId,
      }));

      const cellsData = rowsData.flatMap((row) =>
        columns.map((col) => ({
          rowId: row.id,
          columnId: col.id,
          value: faker.word.words(2),
        }))
      );

      try {
        await ctx.db.row.createMany({ data: rowsData, skipDuplicates: true });

        // insert cells in smaller chunks to avoid overload
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < cellsData.length; i += CHUNK_SIZE) {
          const chunk = cellsData.slice(i, i + CHUNK_SIZE);
          await ctx.db.cell.createMany({ data: chunk });
        }

        return {
          success: true,
          batchNumber,
          totalBatches,
          rowsCreated: rowsData.length,
          cellsCreated: cellsData.length,
        };
      } catch (error) {
        console.error(`Batch ${batchNumber}/${totalBatches} failed:`, error);
        throw new Error(
          `Failed to create batch ${batchNumber}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }),
});