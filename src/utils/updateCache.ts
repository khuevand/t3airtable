import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { api } from "~/utils/api";

type RouterOutput = inferRouterOutputs<AppRouter>;
type TableData = RouterOutput["table"]["getTableById"];

type TRPCUtils = ReturnType<typeof api.useUtils>;

type CacheUpdateFn = (old: TableData | undefined) => TableData | undefined;

export function updateTableCache(
  utils: TRPCUtils, 
  baseId: string,
  tableId: string,
  updateFn: CacheUpdateFn
) {
  utils.table.getTableById.setData({ baseId, tableId }, updateFn);
}