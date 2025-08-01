import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

type RouterOutput = inferRouterOutputs<AppRouter>;
type TableData = RouterOutput["table"]["getTableById"];

type CacheUpdateFn = (old: TableData | undefined) => TableData | undefined;

export function updateTableCache(
  utils: any, // or `ReturnType<typeof api.useUtils>` if you want stronger types
  baseId: string,
  tableId: string,
  updateFn: CacheUpdateFn
) {
  utils.table.getTableById.setData({ baseId, tableId }, updateFn);
}
