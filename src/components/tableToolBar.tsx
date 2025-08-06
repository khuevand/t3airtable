import {
  EyeOff,
  ListFilter,
  ArrowUpDown,
  X,
  Search,
  Menu,
  Grid3X3,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  PaintBucket,
  SquareArrowOutUpRight,
  Logs,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "use-debounce";
import { useAuth } from "@clerk/nextjs"; 
import { api } from "~/utils/api";
import { toast } from "react-toastify";
import { useUIStore } from "~/stores/useUIstores";

// Types
interface SortRule {
  columnId: string;
  direction: "asc" | "desc";
  logicalOperator?: "AND" | "OR"; // Optional because first rule doesn't need one
}

interface FilterCondition {
  columnId: string;
  operator: string;
  value: string;
}

interface Column {
  id: string;
  name: string;
  visible: boolean;
}

interface Props {
  onSearchChange?: (value: string) => void;
  searchResult?: { totalMatches: number };
  onToggleColumnVisibility: (columnId: string) => void;
  columns: Column[];
  columnVisibility: Record<string, boolean>;
  onFilteredDataChange: (filteredData: any[] | null) => void;
  sortRules: SortRule[];
  setSortRules: (rules: SortRule[]) => void;
  onApplySort: (rules: SortRule[]) => void;
  tableId: string;
  onDataRefresh?: () => void; // Data refresh
  onRowsAppended?: (newRows: any[]) => void;
}

// Constants
const FILTER_OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "does not contain", label: "does not contain" },
  { value: "is", label: "is" },
  { value: "is not", label: "is not" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const OPERATORS_WITHOUT_VALUE = ["is empty", "is not empty"];

const BATCH_SIZE = 1000;

export default function TableToolbar({
  onSearchChange,
  searchResult,
  onToggleColumnVisibility,
  columns,
  columnVisibility,
  onFilteredDataChange,
  sortRules,
  setSortRules,
  onApplySort,
  tableId,
  onDataRefresh,
}: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const utils = api.useUtils();

  // Hide state
  const isAnyColumnHidden = Object.values(columnVisibility).some((visible) => !visible);

  // Search state
  const [inputValue, setInputValue] = useState("");
  const [debounced] = useDebounce(inputValue, 300);
  
  // UI state
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showHideFields, setShowHideFields] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>('AND');
  const [selectedColumn, setSelectedColumn] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  
  // Row creation state - simplified for 15k rows only
  const [creationProgress, setCreationProgress] = useState<{
    isCreating: boolean;
    created: number;
    batchNumber: number;
  }>({
    isCreating: false,
    created: 0,
    batchNumber: 0,
  });
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // API mutations
  const filterRecordsMutation = api.filter.getFilteredRecords.useMutation({
    onSuccess: (data) => {
      onFilteredDataChange(data);
    },
    onError: (error) => {
      console.error('Filter error:', error);
      toast.error('Failed to apply filters');
      onFilteredDataChange(null);
    }
  });

  // Optimized batch row creation mutation for 15k rows
  const createRowsBatchMutation = api.row.createManyRowsBatch.useMutation({
    onSuccess: (data, variables) => {
      const { batchNumber, totalBatches } = variables;
      setCreationProgress(prev => ({
        ...prev,
        created: prev.created + BATCH_SIZE,
        batchNumber: batchNumber,
      }));

      if (batchNumber === totalBatches) {
        setCreationProgress({ isCreating: false, created: 0, batchNumber: 0 });
        toast.success(`Successfully created 15,000 rows!`);
        onDataRefresh?.();
      }
    },
    onError: (error, variables) => {
      console.error('Create rows batch error:', error);
      setCreationProgress({ isCreating: false, created: 0, batchNumber: 0 });
      toast.error(`Failed to create batch ${variables.batchNumber}. ${error.message}`);
    }
  });

  // Effects
  useEffect(() => {
    if (onSearchChange) onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  useEffect(() => {
    resetFilterForm();
  }, [tableId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hideFieldsRef.current && !hideFieldsRef.current.contains(event.target as Node)) {
        setShowHideFields(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchBox(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper functions
  const resetFilterForm = () => {
    setSelectedColumn("");
    setSelectedOperator("contains");
    setFilterValue("");
  };

  const operatorRequiresValue = (operator: string) => {
    return !OPERATORS_WITHOUT_VALUE.includes(operator);
  };

  const getColumnName = (columnId: string) => {
    return columns.find(col => col.id === columnId)?.name || columnId;
  };

  // Simplified row creation for 15k rows with batching
  const handleCreateRows = useCallback(async () => {
    if (!isLoaded) {
      toast.error('Authentication still loading...');
      return;
    }

    if (!isSignedIn) {
      toast.error('You must be signed in to create rows');
      return;
    }

    if (creationProgress.isCreating) {
      toast.warning('Row creation already in progress');
      return;
    }

    // front end on table tool bar that shows the current rows adding process
    const totalRows = 15000;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

    setCreationProgress({
      isCreating: true,
      created: 0,
      batchNumber: 0,
    });

    try {
      for (let i = 1; i <= totalBatches; i++) {
        const currentBatchSize = i === totalBatches 
          ? totalRows - (i - 1) * BATCH_SIZE 
          : BATCH_SIZE;

        await createRowsBatchMutation.mutateAsync({
          tableId,
          count: currentBatchSize,
          batchNumber: i,
          totalBatches,
        });

        // Small delay between batches
        if (i < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error in batch creation:', error);
      setCreationProgress({ isCreating: false, created: 0, batchNumber: 0 });
    }
  }, [isLoaded, isSignedIn, creationProgress.isCreating, tableId, onDataRefresh]);

  // Event handlers
  const handleAddFilter = () => {
    if (!selectedColumn) return;
    if (operatorRequiresValue(selectedOperator) && !filterValue.trim()) return;

    const newFilter: FilterCondition = {
      columnId: selectedColumn,
      operator: selectedOperator,
      value: operatorRequiresValue(selectedOperator) ? filterValue : '',
    };

    setFilters(prev => [...prev, newFilter]);
    resetFilterForm();
  };

  const handleApplyFilters = async () => {
    if (filters.length === 0) {
      onFilteredDataChange(null);
      return;
    }

    if (!isLoaded) {
      toast.error('Authentication still loading...');
      return;
    }

    if (!isSignedIn) {
      toast.error('You must be signed in to filter records');
      return;
    }

    try {
      console.log(filters);
      await filterRecordsMutation.mutateAsync({
        tableId: tableId,
        filters: filters,
        logicalOperator: logicalOperator,
      });
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(prev => {
      const newFilters = prev.filter((_, i) => i !== index);
      if (newFilters.length === 0) {
        onFilteredDataChange(null);
      }
      return newFilters;
    });
  };

  const handleClearAllFilters = () => {
    setFilters([]);
    resetFilterForm();
    setLogicalOperator('AND');
    onFilteredDataChange(null);
  };

  const handleApplySort = () => {
    const validSorts = sortRules.filter(rule => rule.columnId !== "");
    onApplySort(validSorts);
  };

  const handleAddSortRule = () => {
    setSortRules([...sortRules, { 
      columnId: "", 
      direction: "asc",
      logicalOperator: "AND" // Default to AND for new rules
    }]);
  };

  const handleRemoveSortRule = (index: number) => {
    const updatedRules = sortRules.filter((_, i) => i !== index);
    setSortRules(updatedRules);

    // If no valid sort remains, reset to default
    const hasValidSort = updatedRules.some(rule => rule.columnId);
    if (!hasValidSort) {
      onApplySort([]);
    } else {
      onApplySort(updatedRules);
    } 

    void utils.table.getTableById.invalidate();
  };


  const handleClearAllSorts = () => {
    setSortRules([]);
    onApplySort([]);
    void utils.table.getTableById.invalidate();
  };

  const handleUpdateSortRule = (index: number, field: keyof SortRule, value: any) => {
    const updated = [...sortRules];
    if (updated[index]) {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSortRules(updated);
  };

  // Initialize sortRules if empty when component mounts
  useEffect(() => {
    if (sortRules.length === 0) {
      setSortRules([{ columnId: "", direction: "asc" }]); // First rule doesn't need logicalOperator
    }
  }, []);

  // Render functions
  const renderFilterConditions = () => {
    if (filters.length === 0) return null;

    return (
      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-2">Applied Filters:</div>
        {filters.map((filter, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs mb-1">
            <span>
              {index > 0 && (
                <span className="text-gray-500 mr-1">{logicalOperator}</span>
              )}
              {getColumnName(filter.columnId)} {filter.operator} 
              {operatorRequiresValue(filter.operator) ? ` "${filter.value}"` : ''}
            </span>
            <button
              onClick={() => handleRemoveFilter(index)}
              className="text-red-500 hover:text-red-700 ml-2"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderLogicalOperatorSelection = () => {
    if (filters.length <= 1) return null;

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded border">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Show rows that match:
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="logicalOperator"
              value="AND"
              checked={logicalOperator === 'AND'}
              onChange={(e) => setLogicalOperator(e.target.value as 'AND' | 'OR')}
              className="mr-2"
            />
            <span className="text-sm">All conditions (AND)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="logicalOperator"
              value="OR"
              checked={logicalOperator === 'OR'}
              onChange={(e) => setLogicalOperator(e.target.value as 'AND' | 'OR')}
              className="mr-2"
            />
            <span className="text-sm">Any condition (OR)</span>
          </label>
        </div>
      </div>
    );
  };

  const renderColumnVisibilityDropdown = () => (
    <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700">Select Columns to Hide</span>
        <button
          onClick={() => setShowHideFields(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {columns.map((column) => (
          <div key={column.id} className="flex items-center justify-between">
            <span>{column.name}</span>
            <button
              onClick={() => onToggleColumnVisibility(column.id)}
              className={`p-2 rounded-full ${
                !columnVisibility[column.id] ? 'bg-gray-300' : 'bg-green-400'
              }`}
            >
              {!columnVisibility[column.id] ? (
                <ToggleLeft className="w-4 h-4 text-gray-700" />
              ) : (
                <ToggleRight className="w-4 h-4 text-gray-700" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSearchDropdown = () => (
    <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700">Search</span>
        <button onClick={() => setShowSearchBox(false)}>
          <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="w-full border px-2 py-1 rounded text-sm outline-none mb-2"
      />
      <div className="text-xs text-gray-500">
        {searchResult?.totalMatches
          ? `Found ${searchResult.totalMatches} match${
              searchResult.totalMatches > 1 ? "es" : ""
            }`
          : "No matches"}
      </div>
    </div>
  );

  const renderFilterDropdown = () => (
    <div className="absolute right-4 top-full bg-white border border-gray-200 shadow-lg z-40 mt-1 rounded-md w-80">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Filter Records</span>
          <button
            onClick={() => setShowFilterDropdown(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderLogicalOperatorSelection()}
        {renderFilterConditions()}

        <div className="space-y-2">
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
          >
            <option value="">Select Column</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>

          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
          >
            {FILTER_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {operatorRequiresValue(selectedOperator) && (
            <input
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
              placeholder="Enter value"
            />
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAddFilter}
            disabled={!selectedColumn || (operatorRequiresValue(selectedOperator) && !filterValue.trim())}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs flex-1 disabled:bg-gray-300"
          >
            Add Filter
          </button>
          
          {filters.length > 0 && (
            <>
              <button
                onClick={handleApplyFilters}
                disabled={filterRecordsMutation.isPending}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs flex-1 disabled:bg-gray-400"
              >
                {filterRecordsMutation.isPending ? "Applying..." : "Apply"}
              </button>
              <button
                onClick={handleClearAllFilters}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs flex-1"
              >
                Clear All
              </button>
            </>
          )}
        </div>

        {filterRecordsMutation.error && (
          <div className="mt-2 text-xs text-red-600">
            Error: {filterRecordsMutation.error.message}
          </div>
        )}
      </div>
    </div>
  );

  const renderSortDropdown = () => (
    <div className="absolute right-0 top-full mt-1 z-50 w-96 bg-white border rounded shadow-md px-3 py-3 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Sort Rows</span>
        <button
          onClick={() => setShowSortDropdown(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {sortRules.map((rule, index) => (
          <div key={index} className="space-y-2">
            {/* Show logical operator for rules after the first one */}
            {index > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium">Then sort by:</span>
                <select
                  value={rule.logicalOperator || "AND"}
                  onChange={(e) => handleUpdateSortRule(index, 'logicalOperator', e.target.value)}
                  className="border px-2 py-1 rounded text-xs bg-gray-50"
                >
                  <option value="AND">AND (both conditions)</option>
                  <option value="OR">OR (either condition)</option>
                </select>
              </div>
            )}

            {/* Sort rule configuration */}
            <div className="flex gap-2 items-center">
              {index === 0 && (
                <span className="text-xs text-gray-500 font-medium min-w-fit">Sort by:</span>
              )}

              <select
                value={rule.columnId}
                onChange={(e) => handleUpdateSortRule(index, 'columnId', e.target.value)}
                className="flex-1 border px-2 py-1 rounded text-xs"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>

              <select
                value={rule.direction}
                onChange={(e) => handleUpdateSortRule(index, 'direction', e.target.value)}
                className="w-32 border px-2 py-1 rounded text-xs"
              >
                <option value="asc">A → Z / 1 → 9</option>
                <option value="desc">Z → A / 9 → 1</option>
              </select>

              {/* Show X button for every rule */}
              <button
                onClick={() => handleRemoveSortRule(index)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remove this sort rule"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Visual separator for multiple rules */}
            {index < sortRules.length - 1 && (
              <div className="border-l-2 border-gray-200 ml-2 pl-2">
                <div className="text-xs text-gray-400">↓</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sort Rules Preview */}
      {sortRules.some(rule => rule.columnId) && (
        <div className="mt-4 p-2 bg-gray-50 rounded border">
          <div className="text-xs font-medium text-gray-700 mb-1">Sort Preview:</div>
          <div className="text-xs text-gray-600">
            {sortRules
              .filter(rule => rule.columnId)
              .map((rule, index) => {
                const columnName = getColumnName(rule.columnId);
                const direction = rule.direction === 'asc' ? '↑' : '↓';
                const operator = index > 0 ? ` ${rule.logicalOperator} ` : '';
                return `${operator}${columnName} ${direction}`;
              })
              .join('')}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleAddSortRule}
          className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
        >
          + Add another sort
        </button>

        <button
          onClick={handleApplySort}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded flex-1"
          disabled={sortRules.length === 0 || sortRules.every(rule => !rule.columnId)}
        >
          Apply Sort
        </button>

        {sortRules.length > 0 && (
          <button
            onClick={handleClearAllSorts}
            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Help text */}
      <div className="mt-3 text-xs text-gray-500 bg-blue-50 p-2 rounded">
        <strong>AND:</strong> Both conditions must be met for sorting<br/>
        <strong>OR:</strong> Either condition can be used for sorting
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Main Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 text-sm text-gray-700 bg-white">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-gray-100 rounded">
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          <button className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded">
            <Grid3X3 className="w-4 h-4 text-[#1778f7]" />
            <span>Grid view</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Hide Fields */}
          <div className="relative" ref={hideFieldsRef}>
            <button
              onClick={() => {
                setShowHideFields(!showHideFields);
                setShowSearchBox(false);
                setShowFilterDropdown(false);
                setShowSortDropdown(false);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                isAnyColumnHidden ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
              }`}
            >
              <EyeOff className="w-4 h-4" />
              Hide fields
            </button>
            {showHideFields && renderColumnVisibilityDropdown()}
          </div>

          {/* Filter */}
          <button
            onClick={() => {
              setShowFilterDropdown(!showFilterDropdown);
              setShowHideFields(false);
              setShowSearchBox(false);
              setShowSortDropdown(false);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              filters.length > 0
                ? "bg-green-100 text-green-700"
                : showFilterDropdown
                ? "text-gray-600"
                : "hover:bg-gray-100"
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Filter {filters.length > 0 && `(${filters.length})`}
          </button>

          {/* Group */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <Logs className="w-4 h-4" />
            Group
          </button>

          {/* Sort */}
          <button
            onClick={() => {
              setShowSortDropdown(!showSortDropdown);
              setShowFilterDropdown(false);
              setShowHideFields(false);
              setShowSearchBox(false);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              sortRules.filter(rule => rule.columnId).length > 0
                ? "bg-[#ffe0cc] text-gray-700"
                : showSortDropdown
                ? "text-gray-600"
                : "hover:bg-gray-100"
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort{" "}
            {sortRules.filter(rule => rule.columnId).length > 0 &&
              `(${sortRules.filter(rule => rule.columnId).length})`}
          </button>

          {/* Color */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <PaintBucket className="w-4 h-4" />
            Color
          </button>

          {/* Add 15K Rows - Simple button with batching optimization */}
          <button
            onClick={handleCreateRows}
            disabled={creationProgress.isCreating || !isLoaded || !isSignedIn}
            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-xl transition-colors ${
              creationProgress.isCreating
                ? "bg-blue-100 text-blue-700 cursor-not-allowed"
                : "bg-gray-600 hover:bg-gray-500 text-white"
            } disabled:bg-gray-400`}
            title={!isSignedIn ? "Sign in required" : ""}
          >
            {creationProgress.isCreating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Creating...
              </>
            ) : (
              "Add 15k Rows"
            )}
          </button>

          {/* Share and sync */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <SquareArrowOutUpRight className="w-4 h-4" />
            Share and sync
          </button>

          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => {
                setShowSearchBox(!showSearchBox);
                setShowHideFields(false);
                setShowFilterDropdown(false);
                setShowSortDropdown(false);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Search className="w-4 h-4 text-gray-600" />
            </button>
            {showSearchBox && renderSearchDropdown()}
          </div>
        </div>
      </div>

      {/* Progress Bar for 15K Row Creation (when creating) */}
      {creationProgress.isCreating && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between text-sm text-blue-800 mb-1">
            <span>Creating 15,000 rows...</span>
            <span>{Math.round((creationProgress.created / 15000) * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: `${(creationProgress.created / 15000) * 100}%` 
              }}
            />
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {creationProgress.created.toLocaleString()} of 15,000 rows created
            {creationProgress.batchNumber > 0 && ` • Batch ${creationProgress.batchNumber}`}
          </div>
        </div>
      )}

      {/* Dropdowns */}
      {showFilterDropdown && renderFilterDropdown()}
      {showSortDropdown && renderSortDropdown()}
    </div>
  );
}