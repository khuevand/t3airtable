    import { useState, useCallback } from 'react';
    import { useUIStore } from '~/stores/useUIstores';
    import { api } from '~/utils/api';
    import { toast } from 'react-toastify';
    import type { BackendRow } from '~/types/row';

    interface FilterCondition {
    columnId: string;
    operator: string;
    value: string;
    }

    interface SortRule {
    columnId: string;
    direction: "asc" | "desc";
    logicalOperator?: "AND" | "OR";
    }

    interface Column {
    id: string;
    name: string;
    visible: boolean;
    }

    interface UseTableOperationsProps {
    tableId: string;
    baseId: string;
    columns: Column[];
    }

    export function useTableOperations({ tableId, baseId }: UseTableOperationsProps) {
    const set = useUIStore((state) => state.set);
    
    // Centralized state for all operations
    const [operations, setOperations] = useState({
        searchTerm: '',
        searchResults: { totalMatches: 0 },
        filters: [] as FilterCondition[],
        filterLogicalOperator: 'AND' as 'AND' | 'OR',
        sortRules: [] as SortRule[],
        columnVisibility: {} as Record<string, boolean>,
    });

    // Loading states
    const [isFilterLoading, setIsFilterLoading] = useState(false);
    const [isSortLoading, setIsSortLoading] = useState(false);

    // API mutations
    const filterMutation = api.filter.getFilteredRecords.useMutation({
        onMutate: () => {
            setIsFilterLoading(true);
            },
        onSuccess: (data: BackendRow[]) => {
            toast.success(`Filter successed!`, {
                autoClose: 1000,
            });
            set({ filteredData: data });
            setIsFilterLoading(false);
        },
        onError: (error) => {
            console.error('Filter error:', error);
            toast.error('Failed to apply filters');
            set({ filteredData: null });
            setIsFilterLoading(false);
        }
    });

    const sortMutation = api.sort.getSortedRecords.useMutation({
        onMutate: () => {
            setIsSortLoading(true);
        },
        onSuccess: (data: BackendRow[]) => {
            toast.success(`Sort successed!`, {
                autoClose: 1000,
            });
            set({ sortedData: data });
            setIsSortLoading(false);
        },
        onError: (error) => {
            console.error('Sort error:', error);
            toast.error('Failed to apply sorting');
            set({ sortedData: null });
            setIsSortLoading(false);
        }
    });

    // =============================================================================
    // FILTER OPERATIONS
    // =============================================================================
    
    const addFilter = useCallback((filter: FilterCondition) => {
        setOperations(prev => ({
        ...prev,
        filters: [...prev.filters, filter]
        }));
    }, []);

    const applyFilters = useCallback(async () => {
        if (operations.filters.length === 0) {
            set({ filteredData: null });
            return;
        }

        if (!tableId || !baseId) {
            toast.error('Missing table or base information');
            return;
        }

        try {
        console.log('Applying filters:', {
            tableId,
            filters: operations.filters,
            logicalOperator: operations.filterLogicalOperator
        });

        void filterMutation.mutateAsync({
            tableId,
            filters: operations.filters,
            logicalOperator: operations.filterLogicalOperator,
        });
        } catch (error) {
            console.error("Filter application failed:", error);
        }
    }, [operations.filters, operations.filterLogicalOperator, filterMutation, tableId, baseId, set]);

    const removeFilter = useCallback((index: number) => {
        setOperations(prev => {
        const newFilters = prev.filters.filter((_, i) => i !== index);
        if (newFilters.length === 0) {
            set({ filteredData: null });
        } else {
            setTimeout(() => {
            void applyFilters();
            }, 100);
        }
        
        return { ...prev, filters: newFilters };
        });
    }, [set, applyFilters]);


    const clearAllFilters = useCallback(() => {
        setOperations(prev => ({
            ...prev,
            filters: [],
            filterLogicalOperator: 'AND'
        }));
        set({ filteredData: null });
    }, [set]);

    const setFilterLogicalOperator = useCallback((operator: 'AND' | 'OR') => {
        setOperations(prev => ({ ...prev, filterLogicalOperator: operator }));
    }, []);

    // =============================================================================
    // SORT OPERATIONS
    // =============================================================================
    
    const addSortRule = useCallback(() => {
        setOperations(prev => ({
            ...prev,
            sortRules: [...prev.sortRules, { 
                columnId: "", 
                direction: "asc" as const,
                logicalOperator: "AND" as const
            }]
        }));
    }, []);

    const updateSortRule = useCallback((index: number, field: keyof SortRule, value: string) => {
        setOperations(prev => {
        const updated = [...prev.sortRules];
        if (updated[index]) {
            updated[index] = { ...updated[index], [field]: value };
        }
        return { ...prev, sortRules: updated };
        });
    }, []);

    const applySorts = useCallback(async () => {
        const validSorts = operations.sortRules.filter(rule => rule.columnId !== "");
        
        if (validSorts.length === 0) {
        set({ sortedData: null });
        return;
        }

        // Validate that we have the required IDs
        if (!tableId || !baseId) {
        toast.error('Missing table or base information');
        return;
        }

        try {
        console.log('Applying sorts:', {
            tableId,
            sortBy: validSorts.map(rule => ({
            columnId: rule.columnId,
            direction: rule.direction
            }))
        });

        void sortMutation.mutateAsync({
            tableId,
            sortBy: validSorts.map(rule => ({
            columnId: rule.columnId,
            direction: rule.direction
            }))
        });
        } catch (error) {
        console.error("Sort application failed:", error);
        }
    }, [operations.sortRules, sortMutation, tableId, baseId, set]);

    const removeSortRule = useCallback((index: number) => {
        setOperations(prev => {
        const updatedRules = prev.sortRules.filter((_, i) => i !== index);
        // Auto-apply if valid sorts remain, clear if none
        const hasValidSort = updatedRules.some(rule => rule.columnId);
        if (!hasValidSort) {
            set({ sortedData: null });
        } else {
            // Auto-apply remaining sorts
            setTimeout(() => {
            void applySorts();
            }, 100);
        }
        
        return { ...prev, sortRules: updatedRules };
        });
    }, [set, applySorts]);

    const clearAllSorts = useCallback(() => {
        setOperations(prev => ({ ...prev, sortRules: [] }));
        set({ sortedData: null });
    }, [set]);

    // =============================================================================
    // COMPUTED VALUES
    // =============================================================================
    
    const activeFiltersCount = operations.filters.length;
    const activeSortsCount = operations.sortRules.filter(rule => rule.columnId).length;

    // =============================================================================
    // RETURN INTERFACE
    // =============================================================================
    
    return {
        operations,
        activeFiltersCount,
        activeSortsCount,

        addFilter,
        removeFilter,
        applyFilters,
        clearAllFilters,
        setFilterLogicalOperator,
        
        addSortRule,
        updateSortRule,
        removeSortRule,
        applySorts,
        clearAllSorts,
        
        isFilterLoading,
        isSortLoading,
    };
    }