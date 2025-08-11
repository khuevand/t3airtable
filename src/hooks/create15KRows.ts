import { useCallback, useState, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { api } from "~/utils/api";
import { toast } from "react-toastify";
import { useUIStore } from "~/stores/useUIstores";

interface CreationProgress {
  isCreating: boolean;
  created: number;
  batchNumber: number;
  totalBatches: number;
}

interface UseCreateManyRowsProps {
  baseId: string;
  tableId: string;
  tableContainerRef?: React.RefObject<HTMLDivElement>;
  // rowVirtualizer?: any;
  onComplete?: () => void;
}

export const useCreateManyRows = ({
  baseId,
  tableId,
  tableContainerRef,
  // rowVirtualizer,
  onComplete
}: UseCreateManyRowsProps) => {
  const utils = api.useUtils();
  const set = useUIStore((state) => state.set);
  
  const [creationProgress, setCreationProgress] = useState<CreationProgress>({
    isCreating: false,
    created: 0,
    batchNumber: 0,
    totalBatches: 0,
  });

  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  // OPTIMISTIC MUTATION for bulk creation
  const createRowsBatchMutation = api.row.createManyRowsBatch.useMutation({
    async onMutate({ tableId, batchNumber }) {
      if (!baseId) return;
      
      const key = { baseId, tableId };
      
      // Optimistic update only on first batch to avoid performance issues
      if (batchNumber === 1) {
        await utils.table.getTableById.cancel(key);
        const previousData = utils.table.getTableById.getInfiniteData(key);
        utils.table.getTableById.setInfiniteData(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: [], // Clear all pages
            pageParams: []
          };
        });

        set({ 
          filteredData: null,
          sortedData: null,
          selectedRows: new Set(),
          allSelected: false
        });

        if (tableContainerRef?.current) {
          tableContainerRef.current.scrollTop = 0;
        }
        
        setTimeout(() => {
          rowVirtualizerRef.current?.scrollToIndex(0);
        }, 50);

        return { key, previousData };
      }

      return { key, previousData: null };
    },
    
    onSuccess: (result, variables, context) => {
      const { batchNumber, totalBatches, rowsCreated } = result;
      
      setCreationProgress(prev => ({
        ...prev,
        created: prev.created + rowsCreated,
        batchNumber: batchNumber,
      }));

      if (batchNumber % 3 === 0 || batchNumber === totalBatches) {
        toast.success(`Progress: ${batchNumber}/${totalBatches} batches completed`, {
          autoClose: 1000,
          hideProgressBar: true,
        });
      }

      if (batchNumber === totalBatches) {
        setCreationProgress({
          isCreating: false,
          created: 0,
          batchNumber: 0,
          totalBatches: 0,
        });
        
        toast.success(`🎉 Successfully created 15,000 rows!`, {
          autoClose: 3000,
        });

        // Final data refresh after all batches
        setTimeout(async () => {
          if (baseId && tableId) {
            await utils.table.getTableById.invalidate({ baseId, tableId });
            if (tableContainerRef?.current) {
              tableContainerRef.current.scrollTop = 0;
            }
            
            setTimeout(() => {
              rowVirtualizerRef.current?.scrollToIndex(0);
            }, 100);
            onComplete?.();
          }
        }, 300);
      }
    },
    
    onError: (error, variables, context) => {
      console.error('Create rows batch error:', error);
      // Rollback if we encounter error
      if (context?.previousData && context.key) {
        utils.table.getTableById.setInfiniteData(context.key, context.previousData);
      }
      setCreationProgress({
        isCreating: false,
        created: 0,
        batchNumber: 0,
        totalBatches: 0,
      });
      
      toast.error(`Failed to create batch ${variables.batchNumber}: ${error.message}`);
      
      if (baseId && tableId) {
        void utils.table.getTableById.invalidate({ baseId, tableId });
      }
    }
  });

  const handleCreateManyRows = useCallback(async (totalRows = 15000) => {
    if (!baseId || !tableId) {
      toast.error('Missing required information');
      return;
    }

    if (creationProgress.isCreating) {
      toast.warning('Row creation already in progress');
      return;
    }

    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

    setCreationProgress({
      isCreating: true,
      created: 0,
      batchNumber: 0,
      totalBatches,
    });

    try {
      for (let i = 1; i <= totalBatches; i++) {
        const currentBatchSize = i === totalBatches 
          ? totalRows - (i - 1) * BATCH_SIZE 
          : BATCH_SIZE;

        await void createRowsBatchMutation.mutateAsync({
          tableId,
          count: currentBatchSize,
          batchNumber: i,
          totalBatches,
        });

        if (i < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error in batch creation:', error);
      setCreationProgress({
        isCreating: false,
        created: 0,
        batchNumber: 0,
        totalBatches: 0,
      });
    }
  }, [baseId, tableId, creationProgress.isCreating, createRowsBatchMutation]);

  return {
    creationProgress,
    handleCreateManyRows,
    isCreating: createRowsBatchMutation.isPending || creationProgress.isCreating,
    isPending: createRowsBatchMutation.isPending,
  };
};