import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
  // GET: all bases (under current account)
  getAll: privateProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.currentUser?.id;
      if (!userId) throw new Error("Unauthorized");

      const bases = await ctx.db.base.findMany({
        where: { userId: userId },
        orderBy: { updatedAt: "desc" },
      });

      return bases;
    }),

  // POST: Create new base + default table + columns + 3 empty rows
  createBase: privateProcedure.mutation(async ({ ctx }) => {
    const user = ctx.currentUser;
    if (!user) throw new Error("Unauthorized");

    // Ensure user exists in your DB (upsert pattern)
    await ctx.db.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: user.firstName ?? "",
      },
    });

    // Create base after ensuring user exists
    const base = await ctx.db.base.create({
      data: {
        id: uuidv4(),
        name: "Untitled Base",
        userId: user.id,
      },
    });

    const defaultColumns = [
      { name: "Name", type: "text", order: 0 },
      { name: "Notes", type: "text", order: 1 },
      { name: "Assignee", type: "text", order: 2 },
      { name: "Status", type: "text", order: 3 },
      { name: "Attachments", type: "file", order: 4 },
    ];

    const table = await ctx.db.table.create({
      data: {
        name: "Table 1",
        baseId: base.id,
        columns: {
          create: defaultColumns,
        },
      },
      include: { columns: true },
    });

    for (let i = 0; i < 3; i++) {
      await ctx.db.row.create({
        data: {
          tableId: table.id,
          cells: {
            create: table.columns.map((column) => ({
              columnId: column.id,
              value: "",
            })),
          },
        },
      });
    }

    return {
      baseId: base.id,
      table: {
        id: table.id,
        name: table.name,
      },
    };
  }),

  // Alternative approach without uuidv4 (let Prisma generate the ID)
  createBaseAlternative: privateProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.currentUser?.id;
    if (!userId) throw new Error("Unauthorized");
    
    const base = await ctx.db.base.create({
      data: {
        name: "Untitled Base",
        userId: userId,
        // Remove the manual id generation, let Prisma handle it
      },
    });

    const defaultColumns = [
      { name: "Name", type: "text", order: 0 },
      { name: "Notes", type: "text", order: 1 },
      { name: "Assignee", type: "text", order: 2 },
      { name: "Status", type: "text", order: 3 },
      { name: "Attachments", type: "file", order: 4 },
    ];

    const table = await ctx.db.table.create({
      data: {
        name: "Table 1",
        baseId: base.id,
        columns: {
          create: defaultColumns,
        },
      },
      include: { columns: true },
    });

    for (let i = 0; i < 3; i++) {
      await ctx.db.row.create({
        data: {
          tableId: table.id,
          cells: {
            create: table.columns.map((column) => ({
              columnId: column.id,
              value: "",
            })),
          },
        },
      });
    }

    return {
      baseId: base.id,
      table: {
        id: table.id,
        name: table.name,
      },
    };
  }),

  // GET: one base with tables
  getBase: privateProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.currentUser?.id;
      if (!userId) throw new Error("Unauthorized");

      const base = await ctx.db.base.findFirst({
        where: { 
          id: input.baseId,
          userId: userId
        },
        select: {
          id: true,
          name: true,
          updatedAt: true,
          tables: {
            select: {
              id: true,
              name: true,
              columns: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  order: true,
                  visible: true, 
                },
              },
              rows: {
                select: {
                  id: true,
                  cells: {
                    select: {
                      columnId: true,
                      value: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!base || base.tables.length === 0) {
        throw new Error("Base not found");
      }

      const tables = base.tables.map((t) => ({
        id: t.id,
        name: t.name,
      }));

      return { tables };
    }),

  // DELETE: base by id
  deleteBase: privateProcedure
    .input(z.object({ baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.currentUser?.id;
      if (!userId) throw new Error("Unauthorized");

      const base = await ctx.db.base.findFirst({
        where: { 
          id: input.baseId,
          userId: userId
        },
      });

      if (!base) {
        throw new Error("Base not found or you don't have permission to delete it.");
      }

      await ctx.db.base.delete({
        where: { id: input.baseId },
      });

      return { success: true, message: "Base deleted." };
    }),

  getBaseName: privateProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.currentUser?.id;
      if (!userId) throw new Error("Unauthorized");

      const base = await ctx.db.base.findFirst({
        where: { 
          id: input.baseId,
          userId: userId
        },
        select: { name: true },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      return base.name;
    }),
});