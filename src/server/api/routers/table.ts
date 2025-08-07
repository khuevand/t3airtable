import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
  addTable: privateProcedure
  .input(
      z.object({
      baseId: z.string()
      })
  )
  .mutation(async ({ ctx, input }) => {
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

      // Create  new table with default columns
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
  .input(
    z.object({
      baseId: z.string(),
      tableId: z.string(),
      limit: z.number().optional().default(100),
      cursor: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.row.findMany({
      where: { tableId: input.tableId },
      take: input.limit + 1,
      skip: input.cursor ? 1 : 0,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      include: {
        cells: true,
      },
      orderBy: { id: 'asc' },
    });

    const table = await ctx.db.table.findUnique({
      where: { id: input.tableId },
      include: {
        columns: { orderBy: { order: 'asc' } },
      },
    });

    if (!table) throw new Error("Table not found");

    const hasNextPage = rows.length > input.limit;
    const resultRows = hasNextPage ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasNextPage ? resultRows[resultRows.length - 1]?.id : null;

    console.log('Backend pagination:', {
      inputCursor: input.cursor,
      totalFetched: rows.length,
      limit: input.limit,
      hasNextPage,
      nextCursor,
      resultRowsCount: resultRows.length
    });

    return {
      id: table.id,
      name: table.name,
      columns: table.columns,
      rows: resultRows.map(row => ({
        id: row.id,
        cells: row.cells.map(cell => ({
          columnId: cell.columnId,
          value: cell.value,
          id: cell.id,
          rowId: cell.rowId,
        })),
      })),
      nextCursor,
      hasNextPage,
    };
  }),
  
  getTableRows: privateProcedure
  .input(
    z.object({
      tableId: z.string(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(10).max(100).default(50),
    })
  )
  .query(async ({ ctx, input }) => {
    const { tableId, page, pageSize } = input;

    const rows = await ctx.db.row.findMany({
      where: { tableId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
    });

    const rowIds = rows.map((row) => row.id);
    const cells = await ctx.db.cell.findMany({
      where: { rowId: { in: rowIds } },
    });

    const totalRows = await ctx.db.row.count({ where: { tableId } });

    return {
      rows,
      cells,
      totalRows,
      totalPages: Math.ceil(totalRows / pageSize),
      currentPage: page,
    };
  }),
});
