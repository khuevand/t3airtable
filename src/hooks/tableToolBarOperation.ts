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

    export function useTableOperations({ tableId, baseId, columns }: UseTableOperationsProps) {
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
        set({ filteredData: data });
        setIsFilterLoading(false);
        toast.success(`Filtered to ${data.length} rows`), {
          autoClose: 1000,
        }},
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
        set({ sortedData: data });
        setIsSortLoading(false);
        toast.success('Sorting applied'), {
          autoClose: 1000,
        }},
        onError: (error) => {
        console.error('Sort error:', error);
        toast.error('Failed to apply sorting');
        set({ sortedData: null });
        setIsSortLoading(false);
        }
    });

    const columnVisibilityMutation = api.table.updateColumnVisibility.useMutation({
        onSuccess: () => {
        toast.success('Column visibility updated'), {
          autoClose: 1000,
        }},
        onError: () => {
        toast.error('Failed to update column visibility');
        }
    });

    // =============================================================================
    // SEARCH OPERATIONS
    // =============================================================================
    
    const updateSearch = useCallback((term: string) => {
        setOperations(prev => ({ ...prev, searchTerm: term }));
        
        // Calculate search results
        if (!term.trim()) {
        setOperations(prev => ({ ...prev, searchResults: { totalMatches: 0 } }));
        return;
        }

        let totalMatches = 0;
        const searchLower = term.toLowerCase();

        // Search in column names
        columns.forEach(column => {
        if (column.name.toLowerCase().includes(searchLower)) {
            totalMatches++;
        }
        });

        setOperations(prev => ({ 
        ...prev, 
        searchResults: { totalMatches }
        }));
    }, [columns]);

    const clearSearch = useCallback(() => {
        setOperations(prev => ({ 
        ...prev, 
        searchTerm: '',
        searchResults: { totalMatches: 0 }
        }));
    }, []);

    // =============================================================================
    // FILTER OPERATIONS
    // =============================================================================
    
    const addFilter = useCallback((filter: FilterCondition) => {
        setOperations(prev => ({
        ...prev,
        filters: [...prev.filters, filter]
        }));
    }, []);

    const removeFilter = useCallback((index: number) => {
        setOperations(prev => {
        const newFilters = prev.filters.filter((_, i) => i !== index);
        if (newFilters.length === 0) {
            set({ filteredData: null });
        } else {
            setTimeout(() => {
            applyFilters();
            }, 100);
        }
        
        return { ...prev, filters: newFilters };
        });
    }, [set]);

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

        await filterMutation.mutateAsync({
            tableId,
            filters: operations.filters,
            logicalOperator: operations.filterLogicalOperator,
        });
        } catch (error) {
        console.error("Filter application failed:", error);
        }
    }, [operations.filters, operations.filterLogicalOperator, filterMutation, tableId, baseId, set]);

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
            applySorts();
            }, 100);
        }
        
        return { ...prev, sortRules: updatedRules };
        });
    }, [set]);

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

        await sortMutation.mutateAsync({
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

    const clearAllSorts = useCallback(() => {
        setOperations(prev => ({ ...prev, sortRules: [] }));
        set({ sortedData: null });
    }, [set]);

    // =============================================================================
    // COLUMN VISIBILITY OPERATIONS
    // =============================================================================
    
    const toggleColumnVisibility = useCallback(async (columnId: string) => {
        const currentVisibility = operations.columnVisibility[columnId] ?? true;
        const newVisibility = !currentVisibility;
        
        setOperations(prev => ({
        ...prev,
        columnVisibility: {
            ...prev.columnVisibility,
            [columnId]: newVisibility
        }
        }));

        try {
        await columnVisibilityMutation.mutateAsync({
            columnId,
            visible: newVisibility,
        });
        } catch (error) {
        setOperations(prev => ({
            ...prev,
            columnVisibility: {
            ...prev.columnVisibility,
            [columnId]: currentVisibility
            }
        }));
        console.error("Toggle column visibility failed:", error);
        }
    }, [operations.columnVisibility, columnVisibilityMutation]);

    const initializeColumnVisibility = useCallback((columns: Column[]) => {
        const visibilityState = columns.reduce((acc, col) => {
        acc[col.id] = col.visible;
        return acc;
        }, {} as Record<string, boolean>);
        
        setOperations(prev => ({ ...prev, columnVisibility: visibilityState }));
    }, []);

    // =============================================================================
    // COMPUTED VALUES
    // =============================================================================
    
    const isAnyColumnHidden = Object.values(operations.columnVisibility).some(visible => !visible);
    const activeFiltersCount = operations.filters.length;
    const activeSortsCount = operations.sortRules.filter(rule => rule.columnId).length;

    // =============================================================================
    // RETURN INTERFACE
    // =============================================================================
    
    return {
        operations,
        isAnyColumnHidden,
        activeFiltersCount,
        activeSortsCount,
        
        updateSearch,
        clearSearch,
        
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
        
        toggleColumnVisibility,
        initializeColumnVisibility,
        
        isFilterLoading,
        isSortLoading,
        isColumnVisibilityLoading: columnVisibilityMutation.isPending,
    };
    }