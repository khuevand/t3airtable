// server/api/helpers/filterRowByCondition.ts
import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";
import { Prisma } from "@prisma/client";

export const filterRouter = createTRPCRouter({
  getFilteredRecords: privateProcedure
    .input(
      z.object({
        tableId: z.string(), // Add tableId to input
        filters: z.array(
          z.object({
            columnId: z.string(),
            operator: z.string(),
            value: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { filters, tableId } = input; // Destructure tableId from input

      if (filters.length === 0) {
        // If no filters, return all rows for the table
        const rows = await ctx.db.row.findMany({
          where: {
            tableId: tableId,
          },
          include: {
            cells: true,
          },
        });
        return rows;
      }

      // Helper function to build filter conditions
      const buildFilterCondition = (columnId: string, operator: string, value: string) => {
        switch (operator) {
          case "contains":
            return {
              cells: {
                some: {
                  columnId: columnId,
                  value: {
                    contains: value,
                  },
                },
              },
            } as Prisma.RowWhereInput;

          case "does not contain":
            return {
              NOT: {
                cells: {
                  some: {
                    columnId: columnId,
                    value: {
                      contains: value,
                    },
                  },
                },
              },
            } as Prisma.RowWhereInput;

          case "is":
            return {
              cells: {
                some: {
                  columnId: columnId,
                  value: {
                    equals: value,
                  },
                },
              },
            } as Prisma.RowWhereInput;

          case "is not":
            return {
              NOT: {
                cells: {
                  some: {
                    columnId: columnId,
                    value: {
                      equals: value,
                    },
                  },
                },
              },
            } as Prisma.RowWhereInput;

          case "is empty":
            return {
              OR: [
                // Row has no cell for this column
                {
                  cells: {
                    none: {
                      columnId: columnId,
                    },
                  },
                },
                // Row has cell for this column but value is null or empty
                {
                  cells: {
                    some: {
                      columnId: columnId,
                      OR: [
                        { value: null },
                        { value: "" },
                      ],
                    },
                  },
                },
              ],
            } as Prisma.RowWhereInput;

          case "is not empty":
            return {
              cells: {
                some: {
                  columnId: columnId,
                  AND: [
                    {
                      value: {
                        not: null,
                      },
                    },
                    {
                      value: {
                        not: "",
                      },
                    },
                  ],
                },
              },
            } as Prisma.RowWhereInput;

          default:
            // Return a condition that matches all rows (effectively no filter)
            return {} as Prisma.RowWhereInput;
        }
      };

      // Build the where clause properly for multiple filters
      let whereClause: Prisma.RowWhereInput;

      if (filters.length > 1) {
        // Handle multiple filters with AND logic
        const filterConditions = filters
          .map((filter) => buildFilterCondition(filter.columnId, filter.operator, filter.value))
          .filter((condition) => Object.keys(condition).length > 0);

        whereClause = {
          tableId: tableId,
          AND: filterConditions,
        };
      } else {
        // Handle single filter
        const filter = filters[0]!;
        const filterCondition = buildFilterCondition(filter.columnId, filter.operator, filter.value);
        
        whereClause = {
          tableId: tableId,
          ...filterCondition,
        };
      }

      console.log("Where clause:", JSON.stringify(whereClause, null, 2));

      try {
        const rows = await ctx.db.row.findMany({
          where: whereClause,
          include: {
            cells: {
              include: {
                column: true, // Include column info for better debugging
              },
            },
          },
          orderBy: {
            id: 'asc', // Use 'id' instead of 'createdAt'
          },
        });

        console.log(`Found ${rows.length} rows matching filters`);
        return rows;
      } catch (error) {
        console.error("Database query error:", error);
        throw new Error("Failed to apply filters");
      }
    }),
});