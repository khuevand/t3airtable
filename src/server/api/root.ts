import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { cellRouter } from "./routers/cell";
import { tableRouter } from "./routers/table";
import { rowRouter } from "./routers/row";
import { columnRouter } from "./routers/column";
import { baseRouter } from "./routers/base";
import { filterRouter } from "./routers/filterRowByCondtion";
import { sortRouter } from "./routers/sortRouters";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: baseRouter,
  row: rowRouter,
  column: columnRouter,
  table: tableRouter,
  cell: cellRouter,
  filter: filterRouter,
  sort: sortRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
