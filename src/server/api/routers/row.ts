import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";


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

        return { success: true, rowId: input.rowId  };
    }),

    // Updated: Optimized batch creation for large datasets
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

          // Optional: insert cells in smaller chunks (to avoid overload)
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
    
    // Keep the original for backward compatibility
    createManyRows: privateProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(1000), // Limit to 1,000 rows per call
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, count } = input;

      // Fetch columns
      const columns = await ctx.db.column.findMany({ where: { tableId } });
      if (!columns.length) throw new Error("No columns found");

      // Generate rows
      const rowsData = Array.from({ length: count }).map(() => ({
        id: crypto.randomUUID(),
        tableId,
      }));

      // Generate cells
      const cellsData = rowsData.flatMap((row) =>
        columns.map((col) => ({
          rowId: row.id,
          columnId: col.id,
          value: faker.word.words(2),
        }))
      );

      try {
        await ctx.db.row.createMany({ data: rowsData });
        await ctx.db.cell.createMany({ data: cellsData });
        return { success: true, rowsCreated: count };
      } catch (error) {
         throw new Error(`Failed to create rows: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

    // Optional: Add a procedure to get row creation progress/stats
    getRowStats: privateProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
        const totalRows = await ctx.db.row.count({
            where: { tableId: input.tableId },
        });

        const totalCells = await ctx.db.cell.count({
            where: { 
                row: { tableId: input.tableId }
            },
        });

        return {
            totalRows,
            totalCells,
            averageCellsPerRow: totalRows > 0 ? Math.round(totalCells / totalRows) : 0,
        };
    }),
});