import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
    addTable: privateProcedure
    .input(
        z.object({
        baseId: z.string()
        })
    )
    .mutation(async ({ ctx, input }) => {
        // Count how many tables already exist in this base
        const existingTablesCount = await ctx.db.table.count({
        where: {
            baseId: input.baseId,
        },
        });

        const newTableName = `Table ${existingTablesCount + 1}`;

        const defaultColumns = [
        { name: "Name", type: "text", order: 0 },
        { name: "Notes", type: "text", order: 1 },
        { name: "Assignee", type: "text", order: 2 },
        { name: "Status", type: "text", order: 3 },
        { name: "Attachments", type: "text", order: 4 },
        ];

        // Create the new table with default columns
        const table = await ctx.db.table.create({
        data: {
            name: newTableName,
            baseId: input.baseId,
            columns: {
            create: defaultColumns,
            },
        },
        include: {
            columns: true,
        },
        });

        // Add 3 empty rows with cells for each column
        for (let i = 0; i < 3; i++) {
        await ctx.db.row.create({
            data: {
            tableId: table.id,
            cells: {
                create: table.columns.map((col) => ({
                columnId: col.id,
                value: "",
                })),
            },
            },
        });
        }

        return {
        id: table.id,
        name: table.name,
        };
    }),

    deleteTable: privateProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Ensure cascading delete works (your schema should already support it via onDelete: Cascade)
      await ctx.db.table.delete({
        where: { id: input.tableId },
      });
      return { success: true };
    }),

    updateColumnVisibility: privateProcedure
    .input(z.object({ columnId: z.string(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
        await ctx.db.column.update({
        where: {
            id: input.columnId,
        },
        data: {
            visible: input.visible,
        },
        });
        return { success: true };
    }),

    getTablesByBase: privateProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
        const tables = await ctx.db.table.findMany({
        where: { baseId: input.baseId },
        include: {
            columns: true,
            rows: {
            include: {
                cells: true,
            },
            },
        },
        });
        return tables;
    }),

    getTableById: privateProcedure
    .input(z.object({ baseId: z.string(), tableId: z.string() }))
    .query(async ({ ctx, input }) => {
        const table = await ctx.db.table.findUnique({
        where: {
            id: input.tableId,
        },
        include: {
            columns: {
            orderBy: { order: 'asc' },
            },
            rows: {
            include: {
                cells: true,
            },
            },
        },
        });

        if (!table) {
        throw new Error("Table not found");
        }

        // Transform the data to match your frontend expectations
        return {
        id: table.id,
        name: table.name,
        columns: table.columns,
        rows: table.rows.map(row => ({
            id: row.id,
            cells: row.cells.map(cell => ({
            columnId: cell.columnId,
            value: cell.value,
            })),
        })),
        };
    }),
});
